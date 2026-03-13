import { EnemyConfig, EnemyType, WaveBalanceConfig } from '../models/configs/balance-types';
import { RandomSource } from './random';

export type WaveEnemySpawnPlan = {
  enemyConfig: EnemyConfig;
  quantity: number;
};

export function getUnlockedEnemyConfigs(enemyConfigs: EnemyConfig[], waveNumber: number): EnemyConfig[] {
  return enemyConfigs.filter(config => config.unlockWave <= waveNumber);
}

export function calculateWaveBudget(waveNumber: number, config: WaveBalanceConfig): number {
  const baseBudget =
    config.budgetBase +
    config.budgetGrowthLinear * waveNumber +
    Math.pow(waveNumber, config.budgetGrowthPower) * config.budgetGrowthFactor;

  const midGameRamp = waveNumber > 15 ? Math.pow(waveNumber - 15, 1.1) * 0.7 : 0;
  const lateGameRamp = waveNumber > 24 ? Math.pow(waveNumber - 24, 1.2) * 1.15 : 0;
  const enduranceRamp = waveNumber > 60 ? Math.pow(waveNumber - 60, 1.3) * 2.45 : 0;

  return baseBudget + midGameRamp + lateGameRamp + enduranceRamp;
}

export function getAdaptiveBudgetMultiplier(config: WaveBalanceConfig, adaptivePressure: number): number {
  const multiplier = config.adaptivePressureBudgetMultiplier ?? 0.22;
  return 1 + adaptivePressure * multiplier;
}

export function getAdaptiveSpawnIntervalMultiplier(config: WaveBalanceConfig, adaptivePressure: number): number {
  const multiplier = config.adaptivePressureSpawnIntervalMultiplier ?? 0.18;
  return Math.max(0.55, 1 - adaptivePressure * multiplier);
}

export function getAdaptiveEliteWeightMultiplier(config: WaveBalanceConfig, adaptivePressure: number): number {
  const multiplier = config.adaptivePressureEliteWeightMultiplier ?? 0.4;
  return 1 + adaptivePressure * multiplier;
}

export function getSpawnIntervalMs(waveNumber: number, config: WaveBalanceConfig, adaptivePressure = 0): number {
  const midGameReduction = waveNumber > 15 ? (waveNumber - 15) * 6 : 0;
  const lateGameReduction = waveNumber > 25 ? (waveNumber - 25) * 7 : 0;
  const baseInterval = Math.max(
    config.minSpawnIntervalMs,
    config.spawnIntervalMs - config.spawnIntervalDecayPerWave * (waveNumber - 1) - midGameReduction - lateGameReduction
  );
  return Math.max(config.minSpawnIntervalMs * 0.6, baseInterval * getAdaptiveSpawnIntervalMultiplier(config, adaptivePressure));
}

export function createWaveSpawnPlan(
  waveNumber: number,
  enemyConfigs: EnemyConfig[],
  config: WaveBalanceConfig,
  random: RandomSource,
  adaptivePressure = 0
): WaveEnemySpawnPlan[] {
  const unlocked = getUnlockedEnemyConfigs(enemyConfigs, waveNumber);
  const quantities = new Map<EnemyType, number>();
  let remainingBudget = calculateWaveBudget(waveNumber, config) * getAdaptiveBudgetMultiplier(config, adaptivePressure);
  let spawnedCount = 0;
  const maxEnemiesForWave = getMaxEnemiesForWave(waveNumber, config);
  const reservedHeavyEnemies = getReservedHeavyEnemies(unlocked, waveNumber, remainingBudget);

  for (const enemy of reservedHeavyEnemies) {
    quantities.set(enemy.type, (quantities.get(enemy.type) ?? 0) + 1);
    remainingBudget -= enemy.threat;
    spawnedCount++;
  }

  while (remainingBudget >= 0.9 && spawnedCount < maxEnemiesForWave) {
    const viable = unlocked.filter(enemy => enemy.threat <= Math.max(remainingBudget * 1.15, unlocked[0]?.threat ?? 1));
    if (viable.length === 0) {
      break;
    }

    const picked = pickWaveEnemy(viable, quantities, waveNumber, config, random, adaptivePressure);
    quantities.set(picked.type, (quantities.get(picked.type) ?? 0) + 1);
    remainingBudget -= picked.threat;
    spawnedCount++;
  }

  if (spawnedCount === 0 && unlocked.length > 0) {
    const fallback = unlocked[0];
    quantities.set(fallback.type, 1);
  }

  return unlocked
    .filter(configEntry => (quantities.get(configEntry.type) ?? 0) > 0)
    .map(configEntry => ({
      enemyConfig: configEntry,
      quantity: quantities.get(configEntry.type)!,
    }));
}

function getMaxEnemiesForWave(waveNumber: number, config: WaveBalanceConfig): number {
  const scaling =
    (waveNumber > 15 ? Math.floor((waveNumber - 15) / 4) : 0) +
    (waveNumber > 28 ? Math.floor((waveNumber - 28) / 3) : 0) +
    (waveNumber > 60 ? Math.floor((waveNumber - 60) / 2) : 0);

  return Math.min(140, config.maxEnemiesPerWave + scaling);
}

function getEnemyWaveWeight(enemy: EnemyConfig, waveNumber: number, config: WaveBalanceConfig): number {
  const baseWeight = enemy.weight * (1 + Math.max(0, waveNumber - enemy.unlockWave) * config.eliteWeightBoostPerWave);
  const heavyBias =
    enemy.threat >= 4 && waveNumber > 15 ? 1 + (waveNumber - 15) * 0.016 : 1;
  const eliteBias =
    enemy.threat >= 6 && waveNumber > 24 ? 1 + (waveNumber - 24) * 0.022 : 1;

  return baseWeight * heavyBias * eliteBias;
}

function getThreatBias(enemy: EnemyConfig, waveNumber: number): number {
  if (waveNumber < 8) {
    return 1;
  }

  const normalizedThreat = Math.max(0.7, Math.min(2.1, enemy.threat / 3.5));
  const waveBias = waveNumber >= 24 ? 1.3 : waveNumber >= 15 ? 1.16 : waveNumber >= 10 ? 1.08 : 1;
  return normalizedThreat * waveBias;
}

function getReservedHeavyEnemies(enemyConfigs: EnemyConfig[], waveNumber: number, remainingBudget: number): EnemyConfig[] {
  if (waveNumber < 8) {
    return [];
  }

  const heavyCandidates = [...enemyConfigs]
    .filter(enemy => enemy.threat <= remainingBudget * 0.6)
    .sort((left, right) => right.threat - left.threat);

  if (heavyCandidates.length === 0) {
    return [];
  }

  const reserveCount = waveNumber >= 24 ? 3 : waveNumber >= 15 ? 2 : 1;
  return heavyCandidates.slice(0, reserveCount);
}

function pickWaveEnemy(
  viable: EnemyConfig[],
  quantities: Map<EnemyType, number>,
  waveNumber: number,
  config: WaveBalanceConfig,
  _random: RandomSource,
  adaptivePressure: number
): EnemyConfig {
  const ranked = viable
    .map(enemy => {
      const count = quantities.get(enemy.type) ?? 0;
      const weight =
        enemy.weight *
        getEnemyWaveWeight(enemy, waveNumber, config) *
        getThreatBias(enemy, waveNumber) *
        getAdaptiveThreatWeight(enemy, config, adaptivePressure);
      const repetitionPenalty = 1 + count * 0.9;

      return {
        enemy,
        score: weight / repetitionPenalty,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.enemy.threat !== left.enemy.threat) {
        return right.enemy.threat - left.enemy.threat;
      }

      if (left.enemy.unlockWave !== right.enemy.unlockWave) {
        return left.enemy.unlockWave - right.enemy.unlockWave;
      }

      return left.enemy.type.localeCompare(right.enemy.type);
    });

  return ranked[0]?.enemy ?? viable[0];
}

function getAdaptiveThreatWeight(enemy: EnemyConfig, config: WaveBalanceConfig, adaptivePressure: number): number {
  if (adaptivePressure <= 0) {
    return 1;
  }

  const eliteMultiplier = getAdaptiveEliteWeightMultiplier(config, adaptivePressure);
  if (enemy.threat >= 6) {
    return eliteMultiplier;
  }
  if (enemy.threat >= 4) {
    return 1 + (eliteMultiplier - 1) * 0.65;
  }
  return 1;
}
