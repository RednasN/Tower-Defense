import { parentPort, workerData } from 'node:worker_threads';

import { BalanceConfig } from '../../src/app/models/configs/balance-types';
import { getPolicyProfiles, simulateBalance, simulateSoloTowerProbe } from '../../src/app/simulation/engine';
import { WeaponType } from '../../src/app/models/weapons/weapon.model';

type RolloutWorkerData = {
  kind: 'rollouts';
  balance: BalanceConfig;
  rolloutSeeds: number[];
  maxWave: number;
};

type SoloProbeWorkerData = {
  kind: 'solo-probes';
  balance: BalanceConfig;
  towerTypes: WeaponType[];
  probeSeeds: number[];
  maxWave: number;
};

const task = workerData as RolloutWorkerData | SoloProbeWorkerData;

if (task.kind === 'rollouts') {
  const policies = getPolicyProfiles();
  const results = task.rolloutSeeds.flatMap(seed => policies.map(policy => simulateBalance(task.balance, policy, seed, task.maxWave)));
  parentPort?.postMessage(results);
} else {
  const soloTowerWaves = Object.fromEntries(
    task.towerTypes.map(towerType => {
      const probes = task.probeSeeds.map(seed => simulateSoloTowerProbe(task.balance, towerType, seed, task.maxWave));
      const averageWave = probes.reduce((sum, probe) => sum + probe.finalWave, 0) / Math.max(1, probes.length);
      return [towerType, averageWave];
    })
  );

  parentPort?.postMessage(soloTowerWaves);
}
