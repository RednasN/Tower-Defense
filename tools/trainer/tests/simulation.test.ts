import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultBalanceConfig } from '../../../src/app/models/balance/default-balance-config';
import { calculateAdaptivePressure, createWavePerformanceMetrics } from '../../../src/app/simulation/adaptive-pressure';
import { canBuildTowerAtCell } from '../../../src/app/simulation/placement';
import { createSeededRandom } from '../../../src/app/simulation/random';
import { createWaveSpawnPlan, getUnlockedEnemyConfigs } from '../../../src/app/simulation/wave-generation';
import { getPolicyProfiles, mutateBalanceConfig, simulateBalance } from '../../../src/app/simulation/engine';

test('path placement is invalid and off-path placement is valid', () => {
  assert.equal(canBuildTowerAtCell(2, 0), false);
  assert.equal(canBuildTowerAtCell(0, 0), true);
});

test('wave generator unlocks stronger enemies over time', () => {
  const early = getUnlockedEnemyConfigs(defaultBalanceConfig.enemies, 1);
  const late = getUnlockedEnemyConfigs(defaultBalanceConfig.enemies, 12);
  assert.ok(early.length < late.length);
});

test('wave generator creates non-empty spawn plans', () => {
  const plan = createWaveSpawnPlan(5, defaultBalanceConfig.enemies, defaultBalanceConfig.waves, createSeededRandom(42));
  assert.ok(plan.length > 0);
  assert.ok(plan.some(entry => entry.quantity > 0));
});

test('hoarder performs worse than mixed policy on baseline balance', () => {
  const policies = getPolicyProfiles();
  const mixed = policies.find(policy => policy.name === 'mixed');
  const hoarder = policies.find(policy => policy.name === 'hoarder');

  assert.ok(mixed);
  assert.ok(hoarder);

  const mixedResult = simulateBalance(defaultBalanceConfig, mixed!, 1234);
  const hoarderResult = simulateBalance(defaultBalanceConfig, hoarder!, 1234);

  assert.ok(mixedResult.score.total > hoarderResult.score.total);
});

test('mutated balance remains simulation-compatible', () => {
  const mutated = mutateBalanceConfig(defaultBalanceConfig, createSeededRandom(55));
  const result = simulateBalance(mutated, getPolicyProfiles()[0], 222);
  assert.ok(result.finalWave >= 1);
});

test('adaptive pressure rises when enemies die before halfway', () => {
  const metrics = createWavePerformanceMetrics();
  metrics.furthestProgress = 0.24;
  metrics.totalResolvedProgress = 0.9;
  metrics.resolvedEnemies = 4;
  metrics.peakAliveEnemies = 3;

  const pressure = calculateAdaptivePressure(0, 12, metrics);
  assert.ok(pressure > 0.2);
});
