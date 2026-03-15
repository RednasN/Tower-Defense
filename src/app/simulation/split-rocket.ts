import { EnemyTank } from '../models/enemies/enemy-tank.model';

export type SplitRocketConfigInput = {
  childRocketCount: number;
  childSearchRadius: number;
};

export function selectSplitRocketTargets(
  enemies: EnemyTank[],
  x: number,
  y: number,
  currentEnemyIndex: number,
  config: SplitRocketConfigInput
): number[] {
  const candidates = enemies
    .map((enemy, enemyIndex) => ({
      enemy,
      enemyIndex,
      distance: Math.hypot(enemy.drawx + 25 - x, enemy.drawy + 25 - y),
    }))
    .filter(candidate => candidate.enemy.lives > 0 && candidate.distance <= config.childSearchRadius)
    .sort((left, right) => left.distance - right.distance);

  const preferred = candidates.filter(candidate => candidate.enemyIndex !== currentEnemyIndex);
  const fallback = candidates.filter(candidate => candidate.enemyIndex === currentEnemyIndex);
  const ordered = [...preferred, ...fallback];
  if (ordered.length === 0) {
    return [];
  }

  const selected = ordered.slice(0, config.childRocketCount).map(candidate => candidate.enemyIndex);
  while (selected.length < config.childRocketCount) {
    selected.push(ordered[selected.length % ordered.length].enemyIndex);
  }

  return selected;
}
