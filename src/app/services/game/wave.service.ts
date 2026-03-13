import { Injectable, inject } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { EnemyConfig, EnemyType, enemyConfigs } from '../../models/configs/turret-config.model';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { EnemyEscapedEvent, WaveEnemySpawnPlan, WaveState } from '../../models/game/wave.model';
import { EnemyService } from '../enemies/enemy.service';

import { ImageService } from './image.service';

const EASY_SPAWN_INTERVAL_MS = 1600;

type WaveQueueEntry = {
  enemyConfig: EnemyConfig;
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
  });
  public readonly waveState$ = this.waveState.asObservable();

  private currentSpawnPlan: WaveEnemySpawnPlan[] = [];
  private spawnQueue: WaveQueueEntry[] = [];
  private spawnTimerMs = 0;
  private escapedHandler: ((event: EnemyEscapedEvent) => void) | null = null;

  private readonly enemyTypeByEnemy = new Map<EnemyTank, EnemyType>();
  private readonly waveNumberByEnemy = new Map<EnemyTank, number>();
  private readonly reportedEscapes = new Set<EnemyTank>();

  public initialize(): void {
    this.currentSpawnPlan = [];
    this.spawnQueue = [];
    this.spawnTimerMs = 0;
    this.enemyTypeByEnemy.clear();
    this.waveNumberByEnemy.clear();
    this.reportedEscapes.clear();

    this.waveState.next({
      waveNumber: 1,
      phase: 'intermission',
      intermissionRemainingMs: 10000,
      plannedEnemies: 0,
      spawnedEnemies: 0,
      aliveEnemies: 0,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(1).map(config => config.type),
    });
  }

  public tick(dtMs: number): void {
    this.processEscapedEnemies();

    const state = this.waveState.value;
    const aliveEnemies = this.enemyService.enemies.filter(enemy => enemy.lives > 0).length;

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
        });
        return;
      }

      this.waveState.next({
        ...state,
        spawnedEnemies,
        aliveEnemies,
      });
      return;
    }

    if (state.phase === 'cleanup') {
      if (aliveEnemies === 0) {
        const nextWave = state.waveNumber + 1;
        this.waveState.next({
          waveNumber: nextWave,
          phase: 'intermission',
          intermissionRemainingMs: 10000,
          plannedEnemies: 0,
          spawnedEnemies: 0,
          aliveEnemies: 0,
          unlockedEnemyTypes: this.getUnlockedEnemyConfigs(nextWave).map(config => config.type),
        });
        return;
      }

      this.waveState.next({
        ...state,
        aliveEnemies,
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

    this.waveState.next({
      waveNumber,
      phase: 'spawning',
      intermissionRemainingMs: 0,
      plannedEnemies: this.spawnQueue.length,
      spawnedEnemies: 0,
      aliveEnemies: this.enemyService.enemies.filter(enemy => enemy.lives > 0).length,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(waveNumber).map(config => config.type),
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
    const unlockedEnemyConfigs = this.getUnlockedEnemyConfigs(waveNumber);
    const quantities = new Map<EnemyType, number>();

    for (let pick = 0; pick < 2; pick++) {
      const pickedEnemy = this.pickRandomEnemy(unlockedEnemyConfigs);
      quantities.set(pickedEnemy.type, (quantities.get(pickedEnemy.type) ?? 0) + 1);
    }

    return unlockedEnemyConfigs
      .filter(config => (quantities.get(config.type) ?? 0) > 0)
      .map(config => ({
        enemyConfig: config,
        quantity: quantities.get(config.type)!,
      }));
  }

  private pickRandomEnemy(unlockedEnemyConfigs: typeof enemyConfigs) {
    const index = Math.floor(Math.random() * unlockedEnemyConfigs.length);
    return unlockedEnemyConfigs[index] ?? enemyConfigs[0];
  }

  private spawnNextEnemy(): number | null {
    if (this.spawnQueue.length === 0) {
      return null;
    }

    const queueIndex = Math.floor(Math.random() * this.spawnQueue.length);
    const queuedEnemy = this.spawnQueue[queueIndex];
    this.spawnQueue.splice(queueIndex, 1);
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
    return EASY_SPAWN_INTERVAL_MS;
  }

  private getWaveEnemyCount(waveNumber: number): number {
    return 2;
  }

  private getUnlockedEnemyConfigs(waveNumber: number): typeof enemyConfigs {
    return enemyConfigs;
  }

  private processEscapedEnemies(): void {
    const state = this.waveState.value;
    for (const enemy of this.enemyService.enemies) {
      if (!enemy.escaped || this.reportedEscapes.has(enemy)) {
        continue;
      }

      this.reportedEscapes.add(enemy);
      this.escapedHandler?.({
        waveNumber: this.waveNumberByEnemy.get(enemy) ?? state.waveNumber,
        enemyType: this.enemyTypeByEnemy.get(enemy) ?? EnemyType.Basic,
        timestamp: Date.now(),
      });
    }
  }
}
