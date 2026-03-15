import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultBalanceConfig } from '../../../src/app/models/balance/default-balance-config';
import { WeaponType } from '../../../src/app/models/weapons/weapon.model';
import { getBestBuildAction, getPolicyActions, getPolicyProfile } from '../../../src/app/simulation/policy';
import { canBuildTowerAtCell } from '../../../src/app/simulation/placement';

test('policy opens with a valid off-path build placement', () => {
  const actions = getPolicyActions(
    {
      balance: defaultBalanceConfig,
      money: 999,
      waveNumber: 1,
      phase: 'waiting',
      weapons: [],
    },
    getPolicyProfile('mixed'),
    1
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, 'build');
  if (actions[0]?.kind !== 'build') {
    return;
  }

  assert.equal(canBuildTowerAtCell(actions[0].x, actions[0].y), true);
});

test('upgrade-first policy prefers upgrading when a good affordable upgrade exists', () => {
  const actions = getPolicyActions(
    {
      balance: defaultBalanceConfig,
      money: 15,
      waveNumber: 5,
      phase: 'waiting',
      weapons: [
        {
          type: WeaponType.BulletShooter,
          gridX: 4,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
      ],
    },
    getPolicyProfile('upgrade-first'),
    1
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.kind, 'upgrade');
});

test('build policy never reuses an occupied cell inside a multi-action turn', () => {
  const actions = getPolicyActions(
    {
      balance: defaultBalanceConfig,
      money: 999,
      waveNumber: 3,
      phase: 'waiting',
      weapons: [],
    },
    getPolicyProfile('aggressive-expansion'),
    3
  );

  const buildActions = actions.filter((action): action is Extract<(typeof actions)[number], { kind: 'build' }> => action.kind === 'build');
  const usedCells = new Set(buildActions.map(action => `${action.x},${action.y}`));
  assert.equal(usedCells.size, buildActions.length);
});

test('build evaluation can prefer chain lightning when swarm coverage is missing mid-game', () => {
  const chainLightningCost =
    defaultBalanceConfig.towers.find(tower => tower.type === WeaponType.ChainLightningTower)?.cost ?? 0;

  const action = getBestBuildAction(
    {
      balance: defaultBalanceConfig,
      money: chainLightningCost,
      waveNumber: 9,
      phase: 'waiting',
      weapons: [
        {
          type: WeaponType.BulletShooter,
          gridX: 4,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.FlameThrower,
          gridX: 3,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.SlowRocketLauncher,
          gridX: 5,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.RocketLauncher,
          gridX: 6,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.GrenadeThrower,
          gridX: 7,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
      ],
    },
    getPolicyProfile('mixed')
  );

  assert.ok(action);
  assert.equal(action?.towerType, WeaponType.ChainLightningTower);
});

test('build evaluation can prefer flame thrower when close-range swarm control is missing', () => {
  const flameThrowerCost = defaultBalanceConfig.towers.find(tower => tower.type === WeaponType.FlameThrower)?.cost ?? 0;

  const action = getBestBuildAction(
    {
      balance: defaultBalanceConfig,
      money: flameThrowerCost,
      waveNumber: 6,
      phase: 'waiting',
      weapons: [
        {
          type: WeaponType.BulletShooter,
          gridX: 4,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.RocketLauncher,
          gridX: 6,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
      ],
    },
    getPolicyProfile('mixed')
  );

  assert.ok(action);
  assert.equal(action?.towerType, WeaponType.FlameThrower);
});

test('build evaluation can prefer multi rocket launcher in later-wave anti-clump scenarios', () => {
  const multiRocketCost = defaultBalanceConfig.towers.find(tower => tower.type === WeaponType.MultiRocketLauncher)?.cost ?? 0;

  const action = getBestBuildAction(
    {
      balance: defaultBalanceConfig,
      money: multiRocketCost,
      waveNumber: 12,
      phase: 'waiting',
      weapons: [
        {
          type: WeaponType.BulletShooter,
          gridX: 4,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.FlameThrower,
          gridX: 3,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.GrenadeThrower,
          gridX: 5,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.SlowRocketLauncher,
          gridX: 7,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.ChainLightningTower,
          gridX: 8,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
        {
          type: WeaponType.RocketLauncher,
          gridX: 6,
          gridY: 5,
          speedLevel: 1,
          powerLevel: 1,
          rangeLevel: 1,
        },
      ],
    },
    getPolicyProfile('mixed')
  );

  assert.ok(action);
  assert.equal(action?.towerType, WeaponType.MultiRocketLauncher);
});
