import { EnemyTank } from '../models/enemies/enemy-tank.model';

export type ChainLightningHitPlan = {
  enemyIndex: number;
  damageMultiplier: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type ChainLightningConfigInput = {
  chainCount: number;
  chainRadius: number;
  damageFalloff: number;
};

export function resolveChainLightningShot(
  enemies: EnemyTank[],
  sourceX: number,
  sourceY: number,
  primaryEnemyIndex: number,
  config: ChainLightningConfigInput
): ChainLightningHitPlan[] {
  const primaryEnemy = enemies[primaryEnemyIndex];
  if (!primaryEnemy || primaryEnemy.lives <= 0) {
    return [];
  }

  const hits: ChainLightningHitPlan[] = [];
  const visited = new Set<number>();

  let currentEnemyIndex = primaryEnemyIndex;
  let currentSourceX = sourceX;
  let currentSourceY = sourceY;

  for (let hop = 0; hop <= config.chainCount; hop++) {
    const enemy = enemies[currentEnemyIndex];
    if (!enemy || enemy.lives <= 0) {
      break;
    }

    const targetX = enemy.drawx + 25;
    const targetY = enemy.drawy + 25;

    hits.push({
      enemyIndex: currentEnemyIndex,
      damageMultiplier: hop === 0 ? 1 : Math.pow(config.damageFalloff, hop),
      fromX: currentSourceX,
      fromY: currentSourceY,
      toX: targetX,
      toY: targetY,
    });
    visited.add(currentEnemyIndex);

    if (hop === config.chainCount) {
      break;
    }

    const nextEnemyIndex = findNearestChainTarget(enemies, visited, targetX, targetY, config.chainRadius);
    if (nextEnemyIndex === -1) {
      break;
    }

    currentEnemyIndex = nextEnemyIndex;
    currentSourceX = targetX;
    currentSourceY = targetY;
  }

  return hits;
}

function findNearestChainTarget(
  enemies: EnemyTank[],
  visited: Set<number>,
  sourceX: number,
  sourceY: number,
  chainRadius: number
): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < enemies.length; index++) {
    const enemy = enemies[index];
    if (!enemy || enemy.lives <= 0 || visited.has(index)) {
      continue;
    }

    const distance = Math.hypot(enemy.drawx + 25 - sourceX, enemy.drawy + 25 - sourceY);
    if (distance > chainRadius) {
      continue;
    }

    if (distance < bestDistance - 0.001 || (Math.abs(distance - bestDistance) <= 0.001 && index < bestIndex)) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}
