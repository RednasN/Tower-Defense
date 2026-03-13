import { Injectable, inject } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { EnemyType, getActiveBalanceConfig } from '../../models/configs/turret-config.model';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { EnemyEscapedEvent, WaveEnemySpawnPlan, WaveState } from '../../models/game/wave.model';
import {
  createWaveSpawnPlan,
  getSpawnIntervalMs,
  getUnlockedEnemyConfigs,
} from '../../simulation/wave-generation';
import { createSeededRandom } from '../../simulation/random';
import {
  WavePerformanceMetrics,
  calculateAdaptivePressure,
  createWavePerformanceMetrics,
  recordResolvedEnemyProgress,
  updateWaveMetricsForAliveEnemies,
} from '../../simulation/adaptive-pressure';
import { EnemyService } from '../enemies/enemy.service';

import { ImageService } from './image.service';

type WaveQueueEntry = {
  enemyConfig: ReturnType<typeof getActiveBalanceConfig>['enemies'][number];
  waveNumber: number;
};

@Injectable({
  providedIn: 'root',
})
export class WaveService {
  private readonly enemyService = inject(EnemyService);
  private readonly imageService = inject(ImageService);

  private readonly waveState = new BehaviorSubject<WaveState>({
    waveNumber: 1,
    phase: 'intermission',
    intermissionRemainingMs: 10000,
    plannedEnemies: 0,
    spawnedEnemies: 0,
    aliveEnemies: 0,
    unlockedEnemyTypes: [],
    adaptivePressure: 0,
  });
  public readonly waveState$ = this.waveState.asObservable();

  private currentSpawnPlan: WaveEnemySpawnPlan[] = [];
  private spawnQueue: WaveQueueEntry[] = [];
  private spawnTimerMs = 0;
  private escapedHandler: ((event: EnemyEscapedEvent) => void) | null = null;

  private readonly enemyTypeByEnemy = new Map<EnemyTank, EnemyType>();
  private readonly waveNumberByEnemy = new Map<EnemyTank, number>();
  private readonly reportedEscapes = new Set<EnemyTank>();
  private readonly resolvedEnemies = new Set<EnemyTank>();
  private readonly random = createSeededRandom(Date.now());
  private adaptivePressure = 0;
  private waveMetrics: WavePerformanceMetrics = createWavePerformanceMetrics();

  public initialize(): void {
    this.currentSpawnPlan = [];
    this.spawnQueue = [];
    this.spawnTimerMs = 0;
    this.enemyTypeByEnemy.clear();
    this.waveNumberByEnemy.clear();
    this.reportedEscapes.clear();
    this.resolvedEnemies.clear();
    this.adaptivePressure = 0;
    this.waveMetrics = createWavePerformanceMetrics();

    this.waveState.next({
      waveNumber: 1,
      phase: 'intermission',
      intermissionRemainingMs: 10000,
      plannedEnemies: 0,
      spawnedEnemies: 0,
      aliveEnemies: 0,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(1).map(config => config.type),
      adaptivePressure: 0,
    });
  }

  public tick(dtMs: number): void {
    this.processEscapedEnemies();
    this.processResolvedEnemies();

    const state = this.waveState.value;
    const aliveEnemies = this.enemyService.enemies.filter(enemy => enemy.lives > 0).length;
    updateWaveMetricsForAliveEnemies(this.waveMetrics, this.enemyService.enemies, dtMs);

    if (state.phase === 'intermission') {
      const remainingMs = Math.max(0, state.intermissionRemainingMs - dtMs);

      if (remainingMs === 0) {
        this.startSpawningPhase(state.waveNumber);
        return;
      }

      this.waveState.next({
        ...state,
        intermissionRemainingMs: remainingMs,
        aliveEnemies,
        adaptivePressure: this.adaptivePressure,
      });
      return;
    }

    if (state.phase === 'spawning') {
      this.spawnTimerMs -= dtMs;
      while (this.spawnTimerMs <= 0 && this.spawnQueue.length > 0) {
        const spawnedWaveNumber = this.spawnNextEnemy();
        if (spawnedWaveNumber === null) {
          break;
        }

        this.spawnTimerMs += this.getSpawnIntervalMs(spawnedWaveNumber);
      }

      const spawnedEnemies = state.plannedEnemies - this.spawnQueue.length;
      const hasFinishedSpawning = this.spawnQueue.length === 0;

      if (hasFinishedSpawning) {
        this.waveState.next({
          ...state,
          phase: 'cleanup',
          spawnedEnemies,
          aliveEnemies,
          adaptivePressure: this.adaptivePressure,
        });
        return;
      }

      this.waveState.next({
        ...state,
        spawnedEnemies,
        aliveEnemies,
        adaptivePressure: this.adaptivePressure,
      });
      return;
    }

    if (state.phase === 'cleanup') {
      if (aliveEnemies === 0) {
        const nextWave = state.waveNumber + 1;
        this.adaptivePressure = calculateAdaptivePressure(this.adaptivePressure, state.waveNumber, this.waveMetrics);
        this.waveMetrics = createWavePerformanceMetrics();
        this.waveState.next({
          waveNumber: nextWave,
          phase: 'intermission',
          intermissionRemainingMs: 10000,
          plannedEnemies: 0,
          spawnedEnemies: 0,
          aliveEnemies: 0,
          unlockedEnemyTypes: this.getUnlockedEnemyConfigs(nextWave).map(config => config.type),
          adaptivePressure: this.adaptivePressure,
        });
        return;
      }

      this.waveState.next({
        ...state,
        aliveEnemies,
        adaptivePressure: this.adaptivePressure,
      });
    }
  }

  public startWaveEarly(): void {
    const state = this.waveState.value;
    if (state.phase === 'intermission') {
      this.startSpawningPhase(state.waveNumber);
      return;
    }

    const nextWaveNumber = state.waveNumber + 1;
    if (state.phase === 'spawning') {
      this.addWaveToSpawningPhase(nextWaveNumber);
      return;
    }

    this.startSpawningPhase(nextWaveNumber);
  }

  public setEnemyEscapedHandler(handler: (event: EnemyEscapedEvent) => void): void {
    this.escapedHandler = handler;
  }

  public getCurrentState(): WaveState {
    return this.waveState.value;
  }

  private startSpawningPhase(waveNumber: number): void {
    this.currentSpawnPlan = this.createWaveSpawnPlan(waveNumber);
    this.spawnQueue = this.createWaveQueueEntries(this.currentSpawnPlan, waveNumber);
    this.spawnTimerMs = 0;
    this.waveMetrics = createWavePerformanceMetrics();

    this.waveState.next({
      waveNumber,
      phase: 'spawning',
      intermissionRemainingMs: 0,
      plannedEnemies: this.spawnQueue.length,
      spawnedEnemies: 0,
      aliveEnemies: this.enemyService.enemies.filter(enemy => enemy.lives > 0).length,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(waveNumber).map(config => config.type),
      adaptivePressure: this.adaptivePressure,
    });
  }

  private addWaveToSpawningPhase(waveNumber: number): void {
    const additionalSpawnPlan = this.createWaveSpawnPlan(waveNumber);
    const additionalEntries = this.createWaveQueueEntries(additionalSpawnPlan, waveNumber);
    this.currentSpawnPlan = [...this.currentSpawnPlan, ...additionalSpawnPlan];
    this.spawnQueue.push(...additionalEntries);

    const state = this.waveState.value;
    this.waveState.next({
      ...state,
      waveNumber,
      plannedEnemies: state.plannedEnemies + additionalEntries.length,
      aliveEnemies: this.enemyService.enemies.filter(enemy => enemy.lives > 0).length,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(waveNumber).map(config => config.type),
      adaptivePressure: this.adaptivePressure,
    });
  }

  private createWaveQueueEntries(spawnPlan: WaveEnemySpawnPlan[], waveNumber: number): WaveQueueEntry[] {
    return spawnPlan.flatMap(plan =>
      Array.from({ length: plan.quantity }, () => ({
        enemyConfig: plan.enemyConfig,
        waveNumber,
      }))
    );
  }

  private createWaveSpawnPlan(waveNumber: number): WaveEnemySpawnPlan[] {
    const balance = getActiveBalanceConfig();
    return createWaveSpawnPlan(waveNumber, balance.enemies, balance.waves, this.random, this.adaptivePressure);
  }

  private spawnNextEnemy(): number | null {
    if (this.spawnQueue.length === 0) {
      return null;
    }

    const queuedEnemy = this.spawnQueue.shift();
    if (!queuedEnemy) {
      return null;
    }
    const { enemyConfig, waveNumber } = queuedEnemy;

    const spawnHealth = enemyConfig.health;
    const spawnSpeed = enemyConfig.speed;
    const spawnReward = enemyConfig.reward;

    const imageIndex = this.imageService.enemies.findIndex(enemy => enemy.name === enemyConfig.imageName);

    this.enemyService.createEnemyTank(spawnReward, spawnHealth, imageIndex >= 0 ? imageIndex : 0, enemyConfig.armorClass, spawnSpeed);

    const spawnedEnemy = this.enemyService.enemies[this.enemyService.enemies.length - 1];
    if (spawnedEnemy) {
      this.enemyTypeByEnemy.set(spawnedEnemy, enemyConfig.type);
      this.waveNumberByEnemy.set(spawnedEnemy, waveNumber);
    }

    return waveNumber;
  }

  private getSpawnIntervalMs(waveNumber: number): number {
    const balance = getActiveBalanceConfig();
    return getSpawnIntervalMs(waveNumber, balance.waves, this.adaptivePressure);
  }

  private getUnlockedEnemyConfigs(waveNumber: number) {
    const balance = getActiveBalanceConfig();
    return getUnlockedEnemyConfigs(balance.enemies, waveNumber);
  }

  private processEscapedEnemies(): void {
    const state = this.waveState.value;
    for (const enemy of this.enemyService.enemies) {
      if (!enemy.escaped || this.reportedEscapes.has(enemy)) {
        continue;
      }

      this.reportedEscapes.add(enemy);
      this.resolvedEnemies.add(enemy);
      recordResolvedEnemyProgress(this.waveMetrics, enemy);
      this.escapedHandler?.({
        waveNumber: this.waveNumberByEnemy.get(enemy) ?? state.waveNumber,
        enemyType: this.enemyTypeByEnemy.get(enemy) ?? EnemyType.Basic,
        timestamp: Date.now(),
      });
    }
  }

  private processResolvedEnemies(): void {
    for (const enemy of this.enemyService.enemies) {
      if (enemy.lives > 0 || enemy.escaped || this.resolvedEnemies.has(enemy)) {
        continue;
      }

      this.resolvedEnemies.add(enemy);
      recordResolvedEnemyProgress(this.waveMetrics, enemy);
    }
  }
}
