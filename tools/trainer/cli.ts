import { resolve } from 'node:path';

import { runTraining, TrainerOptions } from './training';

function parseArgs(argv: string[]): TrainerOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith('--') && value) {
      args.set(key.slice(2), value);
    }
  }

  return {
    seed: Number(args.get('seed') ?? '1337'),
    iterations: Number(args.get('iterations') ?? '18'),
    rollouts: Number(args.get('rollouts') ?? '6'),
    workers: Number(args.get('workers') ?? '1'),
    maxWave: Number(args.get('maxWave') ?? '80'),
    seedConfig: args.get('seedConfig') === 'default' ? 'default' : 'generated',
    outputDir: resolve(args.get('outputDir') ?? 'artifacts/balance-training'),
    apply: args.get('apply') !== 'false',
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await runTraining(options);

  console.log(
    JSON.stringify(
      {
        averageScore: result.averageScore,
        averageWave: result.averageWave,
        minScore: result.minScore,
        maxScore: result.maxScore,
        maxWave: options.maxWave,
        seedConfig: options.seedConfig,
        outputDir: options.outputDir,
        applied: options.apply,
      },
      null,
      2
    )
  );
}

void main();
