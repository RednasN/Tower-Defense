import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

import { defaultBalanceConfig } from '../../src/app/models/balance/default-balance-config';
import { BalanceConfig } from '../../src/app/models/configs/balance-types';
import { generatedBalanceConfig } from '../../src/app/models/balance/generated-balance-config';
import { createSeededRandom } from '../../src/app/simulation/random';
import { getPolicyProfiles, mutateBalanceConfig, simulateBalance, simulateSoloTowerProbe } from '../../src/app/simulation/engine';
import { WeaponType } from '../../src/app/models/weapons/weapon.model';
import { buildGeneratedBalanceFile } from './serializer';

export type TrainerOptions = {
  seed: number;
  iterations: number;
  rollouts: number;
  workers: number;
  maxWave: number;
  seedConfig: 'generated' | 'default';
  outputDir: string;
  apply: boolean;
};

export type CandidateEvaluation = {
  balance: BalanceConfig;
  averageScore: number;
  minScore: number;
  maxScore: number;
  averageWave: number;
  averageTurretCount: number;
  averageWaveByPolicy: Record<string, number>;
  soloTowerWaves: Record<string, number>;
  results: ReturnType<typeof simulateBalance>[];
};

type WorkerPayload = {
  balance: BalanceConfig;
  rolloutSeeds: number[];
  maxWave: number;
};

export async function runTraining(options: TrainerOptions): Promise<CandidateEvaluation> {
  const random = createSeededRandom(options.seed);
  mkdirSync(options.outputDir, { recursive: true });

  const initialBalance = options.seedConfig === 'default' ? defaultBalanceConfig : generatedBalanceConfig;
  let best = await evaluateCandidate(initialBalance, buildRolloutSeeds(options.rollouts, random), options.maxWave);
  const leaderboard: CandidateEvaluation[] = [best];
  logIterationSummary('seed', best, best);

  for (let iteration = 0; iteration < options.iterations; iteration++) {
    const candidate = mutateBalanceConfig(best.balance, random);
    const rolloutSeeds = buildRolloutSeeds(options.rollouts, random);
    const evaluation =
      options.workers > 1
        ? await evaluateCandidateWithWorkers(candidate, rolloutSeeds, options.workers, options.maxWave)
        : await evaluateCandidate(candidate, rolloutSeeds, options.maxWave);

    leaderboard.push(evaluation);
    leaderboard.sort((left, right) => right.averageScore - left.averageScore);
    leaderboard.splice(10);

    const isNewBest = evaluation.averageScore > best.averageScore;
    if (isNewBest) {
      best = evaluation;
    }

    logIterationSummary(iteration + 1, evaluation, best);

    if (isNewBest) {
      persistArtifacts(best, leaderboard, options.outputDir, options.maxWave);
      if (options.apply) {
        applyGeneratedBalance(best.balance);
      }
    }
  }

  persistArtifacts(best, leaderboard, options.outputDir, options.maxWave);
  if (options.apply) {
    applyGeneratedBalance(best.balance);
  }

  return best;
}

export async function evaluateCandidate(balance: BalanceConfig, rolloutSeeds: number[], maxWave: number): Promise<CandidateEvaluation> {
  const policies = getPolicyProfiles();
  const results = rolloutSeeds.flatMap(seed => policies.map(policy => simulateBalance(balance, policy, seed, maxWave)));
  return summarizeEvaluation(balance, results, maxWave);
}

async function evaluateCandidateWithWorkers(balance: BalanceConfig, rolloutSeeds: number[], workers: number, maxWave: number): Promise<CandidateEvaluation> {
  const chunks = chunkArray(rolloutSeeds, workers);
  const workerPath = join(__dirname, 'worker.js');
  const results = (
    await Promise.all(
      chunks.map(
        chunk =>
          new Promise<ReturnType<typeof simulateBalance>[]>((resolve, reject) => {
            const worker = new Worker(workerPath, {
              workerData: {
                balance,
                rolloutSeeds: chunk,
                maxWave,
              } satisfies WorkerPayload,
            });

            worker.once('message', message => resolve(message as ReturnType<typeof simulateBalance>[]));
            worker.once('error', reject);
            worker.once('exit', code => {
              if (code !== 0) {
                reject(new Error(`Worker exited with code ${code}`));
              }
            });
          })
      )
    )
  ).flat();

  return summarizeEvaluation(balance, results, maxWave);
}

function summarizeEvaluation(balance: BalanceConfig, results: ReturnType<typeof simulateBalance>[], maxWave: number): CandidateEvaluation {
  const rawAverageScore = average(results.map(result => result.score.total));
  const averageWave = average(results.map(result => result.finalWave));
  const soloTowerWaves = Object.fromEntries(
    balance.towers.map(tower => {
      const probes = [11, 29].map(seed => simulateSoloTowerProbe(balance, tower.type, seed));
      return [tower.type, average(probes.map(probe => probe.finalWave))];
    })
  );
  const adjustedAverageScore = rawAverageScore - calculateCandidatePenalty(results, soloTowerWaves, maxWave);
  const averageTurretCount = average(
    results.map(result => Object.values(result.towerBuildCounts).reduce((sum, count) => sum + (count ?? 0), 0))
  );
  const averageWaveByPolicy = Object.fromEntries(
    getPolicyProfiles().map(policy => [
      policy.name,
      average(results.filter(result => result.policy === policy.name).map(result => result.finalWave)),
    ])
  );
  return {
    balance,
    averageScore: adjustedAverageScore,
    minScore: Math.min(...results.map(result => result.score.total)),
    maxScore: Math.max(...results.map(result => result.score.total)),
    averageWave,
    averageTurretCount,
    averageWaveByPolicy,
    soloTowerWaves,
    results,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTrainerTargetWave(maxWave: number): number {
  return Math.max(10, Math.min(18, Math.round(maxWave * 0.3)));
}

function calculateCandidatePenalty(results: ReturnType<typeof simulateBalance>[], soloTowerWaves: Record<string, number>, maxWave: number): number {
  const waves = results.map(result => result.finalWave);
  const averageWave = average(waves);
  const stdDev = Math.sqrt(average(waves.map(wave => (wave - averageWave) ** 2)));
  const targetWave = getTrainerTargetWave(maxWave);

  const hoarderAverageWave = average(results.filter(result => result.policy === 'hoarder').map(result => result.finalWave));
  const conservativeAverageWave = average(results.filter(result => result.policy === 'conservative').map(result => result.finalWave));
  const mixedAverageWave = average(results.filter(result => result.policy === 'mixed').map(result => result.finalWave));
  const aggressiveAverageWave = average(results.filter(result => result.policy === 'aggressive-expansion').map(result => result.finalWave));
  const upgradeFirstAverageWave = average(results.filter(result => result.policy === 'upgrade-first').map(result => result.finalWave));
  const conservativeAverageSpend = average(results.filter(result => result.policy === 'conservative').map(result => result.averageSpendRatio));
  const conservativeAverageBase = average(results.filter(result => result.policy === 'conservative').map(result => result.baseHealthRemaining));
  const hoarderAverageBase = average(results.filter(result => result.policy === 'hoarder').map(result => result.baseHealthRemaining));

  let penalty = 0;
  penalty += Math.max(0, stdDev - 5) * 2.5;
  penalty += Math.max(0, hoarderAverageWave - 7) * 5.5;
  penalty += Math.max(0, upgradeFirstAverageWave - (targetWave + 2)) * 5.25;
  penalty += Math.max(0, aggressiveAverageWave - (targetWave + 3)) * 3.5;
  penalty += Math.max(0, conservativeAverageWave - (targetWave + 4)) * 4.5;
  penalty += Math.max(0, mixedAverageWave - (targetWave + 6)) * 4.25;
  penalty += Math.max(0, conservativeAverageWave - 15) * 4;
  penalty += Math.max(0, hoarderAverageWave - 15) * 5;
  penalty += conservativeAverageWave > 15 ? conservativeAverageBase * 0.9 : 0;
  penalty += hoarderAverageWave > 15 ? hoarderAverageBase * 1.2 : 0;
  penalty += Math.max(0, averageWave - (targetWave + 5)) * 3.5;
  penalty += Math.max(0, targetWave - averageWave - 2) * 5;
  penalty += Math.max(0, targetWave - mixedAverageWave - 2) * 4;
  penalty += Math.max(0, targetWave - conservativeAverageWave - 1) * 2.5;
  penalty += Math.max(0, conservativeAverageWave - mixedAverageWave - 6) * 3.5;
  penalty += conservativeAverageSpend < 0.7 && conservativeAverageWave > targetWave - 2 ? 14 : 0;
  penalty += calculateSoloTowerPenalty(soloTowerWaves);

  return penalty;
}

function calculateSoloTowerPenalty(soloTowerWaves: Record<string, number>): number {
  let penalty = 0;

  for (const [towerType, averageWave] of Object.entries(soloTowerWaves)) {
    const allowedWave =
      towerType === WeaponType.BulletShooter
        ? 4.5
        : towerType === WeaponType.GrenadeThrower
          ? 4.5
        : towerType === WeaponType.SlowRocketLauncher
          ? 5
        : towerType === WeaponType.RocketLauncher
          ? 5
          : towerType === WeaponType.LaserTurret
                ? 4.75
                : 5.5;

    penalty += Math.max(0, averageWave - allowedWave) * 8;
  }

  return penalty;
}

function chunkArray(values: number[], chunkCount: number): number[][] {
  const chunks = Array.from({ length: Math.max(1, Math.min(chunkCount, values.length)) }, () => [] as number[]);
  values.forEach((value, index) => {
    chunks[index % chunks.length].push(value);
  });
  return chunks.filter(chunk => chunk.length > 0);
}

function buildRolloutSeeds(count: number, random: ReturnType<typeof createSeededRandom>): number[] {
  return Array.from({ length: count }, () => random.nextInt(2_000_000_000));
}

function persistArtifacts(best: CandidateEvaluation, leaderboard: CandidateEvaluation[], outputDir: string, maxWave: number): void {
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(join(outputDir, 'best-balance.json'), JSON.stringify(best.balance, null, 2));
  writeFileSync(
    join(outputDir, 'leaderboard.json'),
    JSON.stringify(
      leaderboard.map(entry => ({
        averageScore: entry.averageScore,
        minScore: entry.minScore,
        maxScore: entry.maxScore,
        averageWave: entry.averageWave,
      })),
      null,
      2
    )
  );
  writeFileSync(
    join(outputDir, 'summary.json'),
    JSON.stringify(
      {
        bestAverageScore: best.averageScore,
        bestAverageWave: best.averageWave,
        maxWave,
        buildableCells: 166,
        results: best.results,
      },
      null,
      2
    )
  );
}

function applyGeneratedBalance(balance: BalanceConfig): void {
  const target = join(process.cwd(), 'src/app/models/balance/generated-balance-config.ts');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildGeneratedBalanceFile(balance));
}

function logIterationSummary(label: number | 'seed', evaluation: CandidateEvaluation, best: CandidateEvaluation): void {
  const policyWaveSummary = Object.entries(evaluation.averageWaveByPolicy)
    .map(([policy, wave]) => `${policy}=${wave.toFixed(2)}`)
    .join(', ');
  const soloSummary = Object.entries(evaluation.soloTowerWaves)
    .map(([towerType, wave]) => `${towerType}=${wave.toFixed(2)}`)
    .join(', ');

  console.log(
    `[train] iteration=${label} avgScore=${evaluation.averageScore.toFixed(2)} avgWave=${evaluation.averageWave.toFixed(
      2
    )} avgTurrets=${evaluation.averageTurretCount.toFixed(2)} bestScore=${best.averageScore.toFixed(
      2
    )} bestAvgWave=${best.averageWave.toFixed(2)} wavesByPolicy{${policyWaveSummary}} soloTowerWaves{${soloSummary}}`
  );
}
