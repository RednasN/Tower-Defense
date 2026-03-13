import { WeaponType } from '../models/weapons/weapon.model';
import { getLevelOneBuildableCells, isLevelOnePathCell, LEVEL_ONE_ROUTE } from '../models/levels/level-one-layout';

export type PlacementCandidate = {
  x: number;
  y: number;
  score: number;
};

export function canBuildTowerAtCell(x: number, y: number): boolean {
  return !isLevelOnePathCell(x, y);
}

export function getRankedPlacementCandidates(): PlacementCandidate[] {
  return getLevelOneBuildableCells()
    .map(([x, y]) => ({
      x,
      y,
      score: calculatePlacementScore(x, y),
    }))
    .sort((left, right) => right.score - left.score);
}

export function calculatePlacementScore(x: number, y: number, type?: WeaponType): number {
  const centerX = x * 50 + 25;
  const centerY = y * 50 + 25;

  let closestDistance = Number.POSITIVE_INFINITY;
  let routeCoverage = 0;

  for (const routeCell of LEVEL_ONE_ROUTE) {
    const routeX = routeCell.drawx + 25;
    const routeY = routeCell.drawy + 25;
    const distance = Math.hypot(routeX - centerX, routeY - centerY);
    closestDistance = Math.min(closestDistance, distance);
    if (distance <= 220) {
      routeCoverage += Math.max(0, 1 - distance / 220);
    }
  }

  const typeBias =
    type === WeaponType.GrenadeThrower
      ? routeCoverage * 0.1
      : type === WeaponType.RocketLauncher || type === WeaponType.NuclearLauncher
        ? closestDistance < 140
          ? 0.45
          : 0
        : 0;

  return routeCoverage + typeBias - closestDistance / 1000;
}
