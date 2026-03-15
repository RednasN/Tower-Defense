import { Injectable, NgZone, inject } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { EnemyType, getActiveBalanceConfig } from '../../models/configs/turret-config.model';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { EnemyEscapedEvent, TimedWaveEnemySpawn, WaveEnemySpawnPlan, WaveState } from '../../models/game/wave.model';
import {
  createWaveSpawnPlan,
  createTimedWaveSpawnSchedule,
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

type ActiveWaveWindow = {
  waveNumber: number;
  spawns: TimedWaveEnemySpawn[];
  elapsedMs: number;
  spawnedCount: number;
  metrics: WavePerformanceMetrics;
};

@Injectable({
  providedIn: 'root',
})
export class WaveService {
  private readonly ngZone = inject(NgZone);
  private readonly enemyService = inject(EnemyService);
  private readonly imageService = inject(ImageService);

  private readonly waveState = new BehaviorSubject<WaveState>({
    waveNumber: 1,
    phase: 'waiting',
    timeUntilNextWaveMs: 15000,
    plannedEnemies: 0,
    spawnedEnemies: 0,
    aliveEnemies: 0,
    unlockedEnemyTypes: [],
    adaptivePressure: 0,
  });
  public readonly waveState$ = this.waveState.asObservable();

  private currentSpawnPlan: WaveEnemySpawnPlan[] = [];
  private activeWaveWindows: ActiveWaveWindow[] = [];
  private escapedHandler: ((event: EnemyEscapedEvent) => void) | null = null;

  private readonly enemyTypeByEnemy = new Map<EnemyTank, EnemyType>();
  private readonly waveNumberByEnemy = new Map<EnemyTank, number>();
  private readonly reportedEscapes = new Set<EnemyTank>();
  private readonly resolvedEnemies = new Set<EnemyTank>();
  private readonly random = createSeededRandom(Date.now());
  private adaptivePressure = 0;
  private nextWaveNumber = 1;
  private lastPressureEvaluatedWave = 0;

  public initialize(): void {
    this.currentSpawnPlan = [];
    this.activeWaveWindows = [];
    this.enemyTypeByEnemy.clear();
    this.waveNumberByEnemy.clear();
    this.reportedEscapes.clear();
    this.resolvedEnemies.clear();
    this.adaptivePressure = 0;
    this.nextWaveNumber = 1;
    this.lastPressureEvaluatedWave = 0;
    const balance = getActiveBalanceConfig();

    this.emitWaveState({
      waveNumber: 1,
      phase: 'waiting',
      timeUntilNextWaveMs: balance.waves.initialWaveCountdownMs,
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
    this.updateActiveWaveMetrics(dtMs);

    let nextWaveCountdownMs = state.timeUntilNextWaveMs - dtMs;
    while (nextWaveCountdownMs <= 0) {
      this.startScheduledWave();
      nextWaveCountdownMs += this.getWaveDurationMs();
    }

    this.advanceActiveWaveWindows(dtMs);
    const aliveEnemies = this.enemyService.enemies.filter(enemy => enemy.lives > 0).length;

    const latestWindow = this.activeWaveWindows[this.activeWaveWindows.length - 1] ?? null;
    this.emitWaveState({
      waveNumber: this.nextWaveNumber === 1 ? 1 : this.nextWaveNumber - 1,
      phase: this.getPhase(aliveEnemies),
      timeUntilNextWaveMs: Math.max(0, nextWaveCountdownMs),
      plannedEnemies: latestWindow?.spawns.length ?? 0,
      spawnedEnemies: latestWindow?.spawnedCount ?? 0,
      aliveEnemies,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(this.nextWaveNumber).map(config => config.type),
      adaptivePressure: this.adaptivePressure,
    });
  }

  public startWaveEarly(): void {
    this.startScheduledWave();
    const aliveEnemies = this.enemyService.enemies.filter(enemy => enemy.lives > 0).length;
    const latestWindow = this.activeWaveWindows[this.activeWaveWindows.length - 1] ?? null;
    this.emitWaveState({
      waveNumber: this.nextWaveNumber - 1,
      phase: this.getPhase(aliveEnemies),
      timeUntilNextWaveMs: this.getWaveDurationMs(),
      plannedEnemies: latestWindow?.spawns.length ?? 0,
      spawnedEnemies: latestWindow?.spawnedCount ?? 0,
      aliveEnemies,
      unlockedEnemyTypes: this.getUnlockedEnemyConfigs(this.nextWaveNumber).map(config => config.type),
      adaptivePressure: this.adaptivePressure,
    });
  }

  public setEnemyEscapedHandler(handler: (event: EnemyEscapedEvent) => void): void {
    this.escapedHandler = handler;
  }

  public getCurrentState(): WaveState {
    return this.waveState.value;
  }

  private createWaveSpawnPlan(waveNumber: number): WaveEnemySpawnPlan[] {
    const balance = getActiveBalanceConfig();
    return createWaveSpawnPlan(waveNumber, balance.enemies, balance.waves, this.random, this.adaptivePressure);
  }

  private spawnEnemy(enemyConfig: ReturnType<typeof getActiveBalanceConfig>['enemies'][number], waveNumber: number): void {
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
  }

  private getUnlockedEnemyConfigs(waveNumber: number) {
    const balance = getActiveBalanceConfig();
    return getUnlockedEnemyConfigs(balance.enemies, waveNumber);
  }

  private getWaveDurationMs(): number {
    return getActiveBalanceConfig().waves.waveDurationMs;
  }

  private startScheduledWave(): void {
    const waveNumber = this.nextWaveNumber;
    if (waveNumber > 1 && this.lastPressureEvaluatedWave < waveNumber - 1) {
      const previousWindow = this.activeWaveWindows.find(window => window.waveNumber === waveNumber - 1);
      if (previousWindow) {
        this.adaptivePressure = calculateAdaptivePressure(this.adaptivePressure, previousWindow.waveNumber, previousWindow.metrics);
        this.lastPressureEvaluatedWave = previousWindow.waveNumber;
      }
    }

    this.currentSpawnPlan = this.createWaveSpawnPlan(waveNumber);
    this.activeWaveWindows.push({
      waveNumber,
      spawns: createTimedWaveSpawnSchedule(this.currentSpawnPlan, waveNumber, this.getWaveDurationMs()),
      elapsedMs: 0,
      spawnedCount: 0,
      metrics: createWavePerformanceMetrics(),
    });
    this.nextWaveNumber++;
  }

  private advanceActiveWaveWindows(dtMs: number): void {
    for (const window of this.activeWaveWindows) {
      window.elapsedMs += dtMs;

      while (window.spawnedCount < window.spawns.length && window.spawns[window.spawnedCount].spawnOffsetMs <= window.elapsedMs) {
        const spawn = window.spawns[window.spawnedCount];
        this.spawnEnemy(spawn.enemyConfig, window.waveNumber);
        window.spawnedCount++;
      }
    }

    this.activeWaveWindows = this.activeWaveWindows.filter(
      window =>
        window.spawnedCount < window.spawns.length ||
        this.hasAliveEnemiesForWave(window.waveNumber) ||
        window.waveNumber > this.lastPressureEvaluatedWave
    );
  }

  private hasAliveEnemiesForWave(waveNumber: number): boolean {
    return this.enemyService.enemies.some(enemy => enemy.lives > 0 && (this.waveNumberByEnemy.get(enemy) ?? 0) === waveNumber);
  }

  private updateActiveWaveMetrics(dtMs: number): void {
    for (const window of this.activeWaveWindows) {
      const aliveEnemies = this.enemyService.enemies.filter(enemy => enemy.lives > 0 && (this.waveNumberByEnemy.get(enemy) ?? 0) === window.waveNumber);
      updateWaveMetricsForAliveEnemies(window.metrics, aliveEnemies, dtMs);
    }
  }

  private getPhase(aliveEnemies: number): WaveState['phase'] {
    if (this.activeWaveWindows.some(window => window.spawnedCount < window.spawns.length)) {
      return 'spawning';
    }

    if (aliveEnemies > 0) {
      return 'cleanup';
    }

    return 'waiting';
  }

  private processEscapedEnemies(): void {
    const state = this.waveState.value;
    for (const enemy of this.enemyService.enemies) {
      if (!enemy.escaped || this.reportedEscapes.has(enemy)) {
        continue;
      }

      this.reportedEscapes.add(enemy);
      this.resolvedEnemies.add(enemy);
      const metrics = this.getMetricsForEnemy(enemy);
      if (metrics) {
        recordResolvedEnemyProgress(metrics, enemy);
      }
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
      const metrics = this.getMetricsForEnemy(enemy);
      if (metrics) {
        recordResolvedEnemyProgress(metrics, enemy);
      }
    }
  }

  private getMetricsForEnemy(enemy: EnemyTank): WavePerformanceMetrics | null {
    const waveNumber = this.waveNumberByEnemy.get(enemy);
    return waveNumber === undefined ? null : this.activeWaveWindows.find(window => window.waveNumber === waveNumber)?.metrics ?? null;
  }

  private emitWaveState(state: WaveState): void {
    if (NgZone.isInAngularZone()) {
      this.waveState.next(state);
      return;
    }

    this.ngZone.run(() => this.waveState.next(state));
  }
}
