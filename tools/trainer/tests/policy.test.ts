import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultBalanceConfig } from '../../../src/app/models/balance/default-balance-config';
import { WeaponType } from '../../../src/app/models/weapons/weapon.model';
import { getPolicyActions, getPolicyProfile } from '../../../src/app/simulation/policy';
import { canBuildTowerAtCell } from '../../../src/app/simulation/placement';

test('policy opens with a valid off-path build placement', () => {
  const actions = getPolicyActions(
    {
      balance: defaultBalanceConfig,
      money: 999,
      waveNumber: 1,
      phase: 'intermission',
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
      phase: 'intermission',
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
      phase: 'intermission',
      weapons: [],
    },
    getPolicyProfile('aggressive-expansion'),
    3
  );

  const buildActions = actions.filter((action): action is Extract<(typeof actions)[number], { kind: 'build' }> => action.kind === 'build');
  const usedCells = new Set(buildActions.map(action => `${action.x},${action.y}`));
  assert.equal(usedCells.size, buildActions.length);
});
