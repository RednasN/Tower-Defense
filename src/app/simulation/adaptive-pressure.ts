import { EnemyTank } from '../models/enemies/enemy-tank.model';
import { LEVEL_ONE_ROUTE } from '../models/levels/level-one-layout';

export type WavePerformanceMetrics = {
  furthestProgress: number;
  totalResolvedProgress: number;
  resolvedEnemies: number;
  peakAliveEnemies: number;
  clearTimeMs: number;
};

const ADAPTIVE_PRESSURE_START_WAVE = 10;
const MAX_ADAPTIVE_PRESSURE = 1;

export function createWavePerformanceMetrics(): WavePerformanceMetrics {
  return {
    furthestProgress: 0,
    totalResolvedProgress: 0,
    resolvedEnemies: 0,
    peakAliveEnemies: 0,
    clearTimeMs: 0,
  };
}

export function updateWaveMetricsForAliveEnemies(metrics: WavePerformanceMetrics, enemies: EnemyTank[], dtMs: number): void {
  const aliveEnemies = enemies.filter(enemy => enemy.lives > 0);
  metrics.peakAliveEnemies = Math.max(metrics.peakAliveEnemies, aliveEnemies.length);
  metrics.clearTimeMs += dtMs;

  for (const enemy of aliveEnemies) {
    metrics.furthestProgress = Math.max(metrics.furthestProgress, getEnemyPathProgress(enemy));
  }
}

export function recordResolvedEnemyProgress(metrics: WavePerformanceMetrics, enemy: EnemyTank): void {
  const progress = getEnemyPathProgress(enemy);
  metrics.furthestProgress = Math.max(metrics.furthestProgress, progress);
  metrics.totalResolvedProgress += progress;
  metrics.resolvedEnemies++;
}

export function calculateAdaptivePressure(currentPressure: number, completedWaveNumber: number, metrics: WavePerformanceMetrics): number {
  if (completedWaveNumber < ADAPTIVE_PRESSURE_START_WAVE || metrics.resolvedEnemies === 0) {
    return 0;
  }

  const averageProgress = metrics.totalResolvedProgress / metrics.resolvedEnemies;
  let increase = 0;

  if (metrics.furthestProgress < 0.5) {
    increase += 0.14;
  }
  if (metrics.furthestProgress < 0.35) {
    increase += 0.1;
  }
  if (metrics.furthestProgress < 0.2) {
    increase += 0.1;
  }
  if (averageProgress < 0.3) {
    increase += 0.06;
  }
  if (metrics.peakAliveEnemies < 4) {
    increase += 0.04;
  }

  if (metrics.furthestProgress > 0.85) {
    increase -= 0.08;
  }
  if (averageProgress > 0.65) {
    increase -= 0.05;
  }

  return clampAdaptivePressure(currentPressure * 0.7 + increase);
}

export function getEnemyPathProgress(enemy: EnemyTank): number {
  if (enemy.escaped) {
    return 1;
  }

  const maxRouteIndex = Math.max(1, LEVEL_ONE_ROUTE.length - 1);
  const routeProgress = (maxRouteIndex - Math.max(0, enemy.routeindex)) / maxRouteIndex;
  const curveProgress = enemy.docurve ? Math.max(0, Math.min(1, enemy.t)) / maxRouteIndex : 0;
  return Math.max(0, Math.min(1, routeProgress + curveProgress));
}

function clampAdaptivePressure(value: number): number {
  return Math.max(0, Math.min(MAX_ADAPTIVE_PRESSURE, Number(value.toFixed(4))));
}
