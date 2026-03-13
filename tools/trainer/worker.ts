import { parentPort, workerData } from 'node:worker_threads';

import { BalanceConfig } from '../../src/app/models/configs/balance-types';
import { getPolicyProfiles, simulateBalance } from '../../src/app/simulation/engine';

const { balance, rolloutSeeds, maxWave } = workerData as { balance: BalanceConfig; rolloutSeeds: number[]; maxWave: number };
const policies = getPolicyProfiles();
const results = rolloutSeeds.flatMap(seed => policies.map(policy => simulateBalance(balance, policy, seed, maxWave)));

parentPort?.postMessage(results);
