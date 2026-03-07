import { Injectable, inject } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { EnemyConfig, EnemyType, enemyConfigs } from '../../models/configs/turret-config.model';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { EnemyEscapedEvent, WaveEnemySpawnPlan, WaveState } from '../../models/game/wave.model';
import { EnemyService } from '../enemies/enemy.service';
import { ImageService } from './image.service';

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
    const totalEnemies = 8 + Math.floor((waveNumber - 1) * 2.5);
    const quantities = new Map<EnemyType, number>();

    for (let pick = 0; pick < totalEnemies; pick++) {
      const pickedEnemy = this.pickWeightedEnemy(unlockedEnemyConfigs, waveNumber);
      quantities.set(pickedEnemy.type, (quantities.get(pickedEnemy.type) ?? 0) + 1);
    }

    return unlockedEnemyConfigs
      .filter(config => (quantities.get(config.type) ?? 0) > 0)
      .map(config => ({
        enemyConfig: config,
        quantity: quantities.get(config.type)!,
      }));
  }

  private pickWeightedEnemy(unlockedEnemyConfigs: typeof enemyConfigs, waveNumber: number) {
    const weights = unlockedEnemyConfigs.map((_, index) => 1 + index * 0.25 + (waveNumber - 1) * index * 0.03);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (let index = 0; index < unlockedEnemyConfigs.length; index++) {
      roll -= weights[index];
      if (roll <= 0) {
        return unlockedEnemyConfigs[index];
      }
    }

    return unlockedEnemyConfigs[unlockedEnemyConfigs.length - 1];
  }

  private spawnNextEnemy(): number | null {
    if (this.spawnQueue.length === 0) {
      return null;
    }

    const queueIndex = Math.floor(Math.random() * this.spawnQueue.length);
    const queuedEnemy = this.spawnQueue[queueIndex];
    this.spawnQueue.splice(queueIndex, 1);
    const { enemyConfig, waveNumber } = queuedEnemy;

    const healthMultiplier = 1 + (waveNumber - 1) * 0.12;
    const speedMultiplier = Math.min(1.6, 1 + (waveNumber - 1) * 0.015);
    const spawnHealth = Math.round(enemyConfig.health * healthMultiplier);
    const spawnSpeed = Math.round(enemyConfig.speed * speedMultiplier);
    const spawnReward = enemyConfig.reward;

    const imageIndex = this.imageService.enemies.findIndex(enemy => enemy.name === enemyConfig.imageName);

    this.enemyService.createEnemyTank(spawnReward, spawnHealth, imageIndex >= 0 ? imageIndex : 0, spawnSpeed);

    const spawnedEnemy = this.enemyService.enemies[this.enemyService.enemies.length - 1];
    if (spawnedEnemy) {
      this.enemyTypeByEnemy.set(spawnedEnemy, enemyConfig.type);
      this.waveNumberByEnemy.set(spawnedEnemy, waveNumber);
    }

    return waveNumber;
  }

  private getSpawnIntervalMs(waveNumber: number): number {
    return Math.max(220, 900 - (waveNumber - 1) * 35);
  }

  private getUnlockedEnemyConfigs(waveNumber: number): typeof enemyConfigs {
    if (waveNumber <= 2) {
      return enemyConfigs.slice(0, 3);
    }
    if (waveNumber <= 4) {
      return enemyConfigs.slice(0, 5);
    }
    if (waveNumber <= 6) {
      return enemyConfigs.slice(0, 7);
    }
    if (waveNumber <= 8) {
      return enemyConfigs.slice(0, 9);
    }

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
