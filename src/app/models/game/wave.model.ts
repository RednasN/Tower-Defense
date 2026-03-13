/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { EnemyConfig, EnemyType } from '../configs/turret-config.model';

export type WavePhase = 'intermission' | 'spawning' | 'cleanup';

export type WaveState = {
  waveNumber: number;
  phase: WavePhase;
  intermissionRemainingMs: number;
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

export type EnemyEscapedEvent = {
  waveNumber: number;
  enemyType: EnemyType;
  timestamp: number;
};
