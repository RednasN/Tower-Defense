import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultBalanceConfig } from '../../../src/app/models/balance/default-balance-config';
import { ArmorClass, EnemyType } from '../../../src/app/models/configs/balance-types';
import { EnemyTank } from '../../../src/app/models/enemies/enemy-tank.model';
import { WeaponType } from '../../../src/app/models/weapons/weapon.model';
import { calculateAdaptivePressure, createWavePerformanceMetrics } from '../../../src/app/simulation/adaptive-pressure';
import { resolveChainLightningShot } from '../../../src/app/simulation/chain-lightning';
import { getFlameBubbleAngles } from '../../../src/app/simulation/flame-bubble';
import { canBuildTowerAtCell } from '../../../src/app/simulation/placement';
import { createSeededRandom } from '../../../src/app/simulation/random';
import { selectSplitRocketTargets } from '../../../src/app/simulation/split-rocket';
import { createTimedWaveSpawnSchedule, createWaveSpawnPlan, getUnlockedEnemyConfigs } from '../../../src/app/simulation/wave-generation';
import { getPolicyProfiles, mutateBalanceConfig, simulateBalance } from '../../../src/app/simulation/engine';

test('path placement is invalid and off-path placement is valid', () => {
  assert.equal(canBuildTowerAtCell(2, 0), false);
  assert.equal(canBuildTowerAtCell(0, 0), true);
});

test('wave generator unlocks stronger enemies over time', () => {
  const early = getUnlockedEnemyConfigs(defaultBalanceConfig.enemies, 1);
  const late = getUnlockedEnemyConfigs(defaultBalanceConfig.enemies, 18);
  assert.ok(early.length < late.length);
  assert.ok(late.some(enemy => enemy.type === EnemyType.InterceptorDrone));
  assert.ok(late.some(enemy => enemy.type === EnemyType.JuggernautMech));
});

test('wave generator creates non-empty spawn plans', () => {
  const plan = createWaveSpawnPlan(5, defaultBalanceConfig.enemies, defaultBalanceConfig.waves, createSeededRandom(42));
  assert.ok(plan.length > 0);
  assert.ok(plan.some(entry => entry.quantity > 0));
});

test('wave schedule spreads enemy spawns across the full wave duration', () => {
  const plan = createWaveSpawnPlan(5, defaultBalanceConfig.enemies, defaultBalanceConfig.waves, createSeededRandom(42));
  const schedule = createTimedWaveSpawnSchedule(plan, 5, defaultBalanceConfig.waves.waveDurationMs);

  assert.ok(schedule.length > 1);
  assert.ok(schedule[0].spawnOffsetMs > 0);
  assert.ok(schedule[schedule.length - 1].spawnOffsetMs <= defaultBalanceConfig.waves.waveDurationMs);
  assert.ok(schedule[schedule.length - 1].spawnOffsetMs > defaultBalanceConfig.waves.waveDurationMs * 0.75);
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

test('chain lightning resolves nearest unique targets with damage falloff', () => {
  const enemies: EnemyTank[] = [
    createEnemy(70, 70),
    createEnemy(120, 80),
    createEnemy(150, 110),
    createEnemy(260, 260),
  ];

  const hits = resolveChainLightningShot(enemies, 25, 25, 0, {
    chainCount: 2,
    chainRadius: 60,
    damageFalloff: 0.7,
  });

  assert.deepEqual(
    hits.map(hit => hit.enemyIndex),
    [0, 1, 2]
  );
  assert.deepEqual(
    hits.map(hit => Number(hit.damageMultiplier.toFixed(4))),
    [1, 0.7, 0.49]
  );
});

test('chain lightning tower remains simulation-compatible', () => {
  const result = simulateBalance(defaultBalanceConfig, getPolicyProfiles()[0], 678, 10);
  assert.ok(result.finalWave >= 1);
  assert.ok(defaultBalanceConfig.towers.some(tower => tower.type === WeaponType.ChainLightningTower));
});

test('flame bubble spread is symmetric around the turret angle', () => {
  const angles = getFlameBubbleAngles(90, 3, 12);
  assert.deepEqual(angles, [78, 90, 102]);
});

test('flame thrower exists in baseline balance and remains simulation-compatible', () => {
  assert.ok(defaultBalanceConfig.towers.some(tower => tower.type === WeaponType.FlameThrower));
  const result = simulateBalance(defaultBalanceConfig, getPolicyProfiles()[0], 679, 10);
  assert.ok(result.finalWave >= 1);
});

test('split rocket targets nearby alternatives before falling back to the primary target', () => {
  const enemies: EnemyTank[] = [
    createEnemy(100, 100),
    createEnemy(115, 105),
    createEnemy(132, 108),
    createEnemy(300, 300),
  ];

  const targets = selectSplitRocketTargets(enemies, 110, 110, 0, {
    childRocketCount: 3,
    childSearchRadius: 40,
  });

  assert.deepEqual(targets, [1, 2, 0]);
});

test('split rocket fills remaining child slots when only one nearby enemy exists', () => {
  const enemies: EnemyTank[] = [createEnemy(100, 100), createEnemy(300, 300)];

  const targets = selectSplitRocketTargets(enemies, 110, 110, 0, {
    childRocketCount: 4,
    childSearchRadius: 40,
  });

  assert.deepEqual(targets, [0, 0, 0, 0]);
});

test('multi rocket launcher exists in baseline balance and remains simulation-compatible', () => {
  assert.ok(defaultBalanceConfig.towers.some(tower => tower.type === WeaponType.MultiRocketLauncher));
  const result = simulateBalance(defaultBalanceConfig, getPolicyProfiles()[0], 680, 10);
  assert.ok(result.finalWave >= 1);
});

function createEnemy(drawx: number, drawy: number): EnemyTank {
  return {
    drawx,
    drawy,
    routeindex: 1,
    lives: 10,
    maxLives: 10,
    reward: 1,
    imageIndex: 0,
    armorClass: ArmorClass.Light,
    curveStartx: null,
    curveStarty: null,
    curveEndx: null,
    curveEndy: null,
    bezierx: null,
    beziery: null,
    t: 0,
    angle: 0,
    died: false,
    escaped: false,
    speed: 100,
    docurve: false,
  };
}
