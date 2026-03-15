/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { EnemyConfig, EnemyType } from '../configs/turret-config.model';

export type WavePhase = 'waiting' | 'spawning' | 'cleanup';

export type WaveState = {
  waveNumber: number;
  phase: WavePhase;
  timeUntilNextWaveMs: number;
  plannedEnemies: number;
  spawnedEnemies: number;
  aliveEnemies: number;
  unlockedEnemyTypes: EnemyType[];
  adaptivePressure: number;
};

export type WaveEnemySpawnPlan = {
  enemyConfig: EnemyConfig;
  quantity: number;
};

export type TimedWaveEnemySpawn = {
  enemyConfig: EnemyConfig;
  waveNumber: number;
  spawnOffsetMs: number;
};

export type EnemyEscapedEvent = {
  waveNumber: number;
  enemyType: EnemyType;
  timestamp: number;
};
