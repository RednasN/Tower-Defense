export type RandomSource = {
  next(): number;
  nextInt(maxExclusive: number): number;
};

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}

export function pickWeightedIndex(weights: number[], random: RandomSource): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    return 0;
  }

  let threshold = random.next() * total;
  for (let index = 0; index < weights.length; index++) {
    threshold -= Math.max(0, weights[index] ?? 0);
    if (threshold <= 0) {
      return index;
    }
  }

  return Math.max(0, weights.length - 1);
}
