import { BalanceConfig, TurretConfig, UpgradeDetails, UpgradeLevelDetails, UpgradeType } from '../models/configs/turret-config.model';
import { WavePhase } from '../models/game/wave.model';
import { Weapon, WeaponType } from '../models/weapons/weapon.model';
import { calculatePlacementScore, canBuildTowerAtCell, getRankedPlacementCandidates } from './placement';
import { getUnlockedEnemyConfigs } from './wave-generation';

export type SimulationPolicyName = 'aggressive-expansion' | 'upgrade-first' | 'mixed' | 'conservative' | 'hoarder';

export type SimulationPolicy = {
  name: SimulationPolicyName;
  buildBias: number;
  upgradeBias: number;
  reserveMultiplier: number;
  waveStartPressure: number;
  allowWaveBuilds: boolean;
};

export type PolicyWeaponState = Pick<Weapon, 'type' | 'gridX' | 'gridY' | 'speedLevel' | 'powerLevel' | 'rangeLevel'>;

export type PolicyContext = {
  balance: BalanceConfig;
  money: number;
  waveNumber: number;
  phase: WavePhase;
  weapons: PolicyWeaponState[];
};

export type BuildTowerPolicyAction = {
  kind: 'build';
  towerType: WeaponType;
  x: number;
  y: number;
  cost: number;
  score: number;
};

export type UpgradeTowerPolicyAction = {
  kind: 'upgrade';
  weaponIndex: number;
  upgradeType: UpgradeType;
  targetLevel: number;
  cost: number;
  score: number;
};

export type PolicyAction = BuildTowerPolicyAction | UpgradeTowerPolicyAction;

const POLICY_PROFILES: SimulationPolicy[] = [
  { name: 'aggressive-expansion', buildBias: 1.35, upgradeBias: 0.8, reserveMultiplier: 0.35, waveStartPressure: 1.15, allowWaveBuilds: true },
  { name: 'upgrade-first', buildBias: 0.7, upgradeBias: 1.45, reserveMultiplier: 0.45, waveStartPressure: 1, allowWaveBuilds: true },
  { name: 'mixed', buildBias: 1, upgradeBias: 1, reserveMultiplier: 0.4, waveStartPressure: 1.05, allowWaveBuilds: true },
  { name: 'conservative', buildBias: 0.72, upgradeBias: 0.82, reserveMultiplier: 1.25, waveStartPressure: 0.8, allowWaveBuilds: false },
  { name: 'hoarder', buildBias: 0.12, upgradeBias: 0.08, reserveMultiplier: 4.2, waveStartPressure: 0.2, allowWaveBuilds: false },
];

export function getPolicyProfiles(): SimulationPolicy[] {
  return [...POLICY_PROFILES];
}

export function getPolicyProfile(name: SimulationPolicyName): SimulationPolicy {
  const policy = POLICY_PROFILES.find(candidate => candidate.name === name);
  if (!policy) {
    throw new Error(`Unknown policy profile ${name}`);
  }

  return policy;
}

export function getPolicyActions(context: PolicyContext, policy: SimulationPolicy, maxActions: number): PolicyAction[] {
  const workingContext: PolicyContext = {
    ...context,
    weapons: context.weapons.map(weapon => ({ ...weapon })),
  };
  const actions: PolicyAction[] = [];

  for (let attempt = 0; attempt < maxActions; attempt++) {
    const shouldBuild = shouldBuildTower(workingContext, policy);
    if (shouldBuild) {
      const buildAction = getBestBuildAction(workingContext, policy);
      if (buildAction) {
        actions.push(buildAction);
        applyBuildAction(workingContext, buildAction);
        continue;
      }
    }

    const upgradeAction = getBestUpgradeAction(workingContext, policy);
    if (upgradeAction) {
      actions.push(upgradeAction);
      applyUpgradeAction(workingContext, upgradeAction);
      continue;
    }

    break;
  }

  return actions;
}

export function shouldBuildTower(context: PolicyContext, policy: SimulationPolicy): boolean {
  if (context.weapons.length === 0) {
    return true;
  }

  const minimumEarlyTowerCount =
    context.waveNumber <= 2 ? 3 : context.waveNumber <= 4 ? 4 : 0;
  if (context.weapons.length < minimumEarlyTowerCount) {
    return true;
  }

  const cheapestTower = Math.min(...context.balance.towers.map(tower => tower.cost));
  const reserve = cheapestTower * policy.reserveMultiplier;
  const pressureBudget = getUnlockedEnemyConfigs(context.balance.enemies, context.waveNumber).length * policy.waveStartPressure * 8;
  return context.money > reserve + pressureBudget * policy.buildBias;
}

export function getBestBuildAction(context: PolicyContext, policy: SimulationPolicy): BuildTowerPolicyAction | null {
  const affordableTowers = context.balance.towers.filter(tower => tower.cost <= context.money);
  if (affordableTowers.length === 0) {
    return null;
  }

  const placements = getRankedPlacementCandidates().filter(
    candidate => !context.weapons.some(weapon => weapon.gridX === candidate.x && weapon.gridY === candidate.y)
  );
  if (placements.length === 0) {
    return null;
  }

  const towerCounts = countWeaponsByType(context.weapons);
  const scoredOptions = affordableTowers.flatMap(tower =>
    placements.slice(0, 12).map(candidate => ({
      kind: 'build' as const,
      towerType: tower.type,
      x: candidate.x,
      y: candidate.y,
      cost: tower.cost,
      score:
        candidate.score * policy.buildBias +
        calculateTowerPreferenceScore(tower.type, context.waveNumber, policy) +
        calculateTowerCompositionScore(context, tower.type, towerCounts) -
        calculateTowerSpamPenalty(tower.type, towerCounts, context.waveNumber) -
        calculateTowerCostPressurePenalty(context, tower.cost),
    }))
  );

  scoredOptions.sort((left, right) => right.score - left.score);
  const picked = scoredOptions[0];
  if (!picked || !canBuildTowerAtCell(picked.x, picked.y)) {
    return null;
  }

  return picked;
}

export function getBestUpgradeAction(context: PolicyContext, policy: SimulationPolicy): UpgradeTowerPolicyAction | null {
  const towerCounts = countWeaponsByType(context.weapons);
  const options = context.weapons.flatMap((weapon, weaponIndex) => {
    const towerConfig = context.balance.towers.find(tower => tower.type === weapon.type);
    if (!towerConfig) {
      return [];
    }

    return towerConfig.upgrades.flatMap(upgrade => {
      const currentLevel = getWeaponUpgradeLevel(weapon, upgrade.type);
      const nextLevel = upgrade.details.find(detail => detail.level === currentLevel + 1);
      if (!nextLevel || nextLevel.cost > context.money) {
        return [];
      }

      return [
        {
          kind: 'upgrade' as const,
          weaponIndex,
          upgradeType: upgrade.type,
          targetLevel: nextLevel.level,
          cost: nextLevel.cost,
          score:
            evaluateUpgradeGain(upgrade, currentLevel) * policy.upgradeBias +
            calculatePlacementScore(weapon.gridX, weapon.gridY, weapon.type) * 0.15 -
            calculateUpgradeSpamPenalty(weapon.type, towerCounts, currentLevel, context.waveNumber) -
            calculateEarlyExpansionUpgradePenalty(context),
        },
      ];
    });
  });

  options.sort((left, right) => right.score - left.score);
  return options[0] ?? null;
}

export function calculateTowerPreferenceScore(type: WeaponType, waveNumber: number, policy: SimulationPolicy): number {
  switch (type) {
    case WeaponType.BulletShooter:
      return waveNumber <= 3 ? 4.2 : 2.4;
    case WeaponType.FlameThrower:
      return waveNumber >= 4 ? 4.4 * policy.buildBias : 1.8;
    case WeaponType.RocketLauncher:
      return waveNumber >= 5 ? 3.3 * policy.buildBias : 1.8;
    case WeaponType.MultiRocketLauncher:
      return waveNumber >= 9 ? 3.9 * policy.buildBias : 0.6;
    case WeaponType.ChainLightningTower:
      return waveNumber >= 6 ? 4 * policy.buildBias : 1.2;
    case WeaponType.LaserTurret:
      return waveNumber >= 8 ? 2.7 * policy.upgradeBias : 0.8;
    case WeaponType.SlowRocketLauncher:
      return waveNumber >= 4 ? 4.2 : 2.8;
    case WeaponType.GrenadeThrower:
      return waveNumber >= 4 ? 3.9 : 2.4;
    case WeaponType.NuclearLauncher:
      return waveNumber >= 10 ? 2.6 : 0.4;
    default:
      return 1;
  }
}

export function evaluateUpgradeGain(upgrade: UpgradeDetails, currentLevel: number): number {
  const current = upgrade.details.find(detail => detail.level === currentLevel);
  const next = upgrade.details.find(detail => detail.level === currentLevel + 1);
  if (!current || !next) {
    return 0;
  }

  const deltaValue = upgrade.type === UpgradeType.Speed ? current.value - next.value : next.value - current.value;
  return deltaValue / Math.max(1, next.cost);
}

export function getWeaponUpgradeLevel(weapon: PolicyWeaponState, upgradeType: UpgradeType): number {
  if (upgradeType === UpgradeType.Speed) {
    return weapon.speedLevel;
  }
  if (upgradeType === UpgradeType.Damage) {
    return weapon.powerLevel;
  }
  return weapon.rangeLevel;
}

export function applyWeaponUpgradeLevel(weapon: PolicyWeaponState, upgradeType: UpgradeType, level: number): void {
  if (upgradeType === UpgradeType.Speed) {
    weapon.speedLevel = level;
    return;
  }
  if (upgradeType === UpgradeType.Damage) {
    weapon.powerLevel = level;
    return;
  }
  weapon.rangeLevel = level;
}

export function getTowerBuildCost(balance: BalanceConfig, type: WeaponType): number {
  return getTowerConfig(balance, type).cost;
}

export function getUpgradeCostForTargetLevel(balance: BalanceConfig, weaponType: WeaponType, upgradeType: UpgradeType, level: number): number {
  const towerConfig = getTowerConfig(balance, weaponType);
  const upgrade = towerConfig.upgrades.find(entry => entry.type === upgradeType);
  const detail = upgrade?.details.find(entry => entry.level === level);
  if (!detail) {
    throw new Error(`Missing upgrade cost for ${weaponType} ${upgradeType} level ${level}`);
  }
  return detail.cost;
}

function getTowerConfig(balance: BalanceConfig, type: WeaponType): TurretConfig {
  const tower = balance.towers.find(entry => entry.type === type);
  if (!tower) {
    throw new Error(`Missing tower config for ${type}`);
  }

  return tower;
}

function applyBuildAction(context: PolicyContext, action: BuildTowerPolicyAction): void {
  context.money -= action.cost;
  context.weapons.push({
    type: action.towerType,
    gridX: action.x,
    gridY: action.y,
    speedLevel: 1,
    powerLevel: 1,
    rangeLevel: 1,
  });
}

function applyUpgradeAction(context: PolicyContext, action: UpgradeTowerPolicyAction): void {
  const weapon = context.weapons[action.weaponIndex];
  if (!weapon) {
    return;
  }

  context.money -= action.cost;
  applyWeaponUpgradeLevel(weapon, action.upgradeType, action.targetLevel);
}

function countWeaponsByType(weapons: PolicyWeaponState[]): Partial<Record<WeaponType, number>> {
  return weapons.reduce<Partial<Record<WeaponType, number>>>((counts, weapon) => {
    counts[weapon.type] = (counts[weapon.type] ?? 0) + 1;
    return counts;
  }, {});
}

function calculateTowerCompositionScore(
  context: PolicyContext,
  towerType: WeaponType,
  towerCounts: Partial<Record<WeaponType, number>>
): number {
  const hasBullet = (towerCounts[WeaponType.BulletShooter] ?? 0) > 0;
  const hasFlame = (towerCounts[WeaponType.FlameThrower] ?? 0) > 0;
  const hasArea = (towerCounts[WeaponType.GrenadeThrower] ?? 0) > 0;
  const hasChain = (towerCounts[WeaponType.ChainLightningTower] ?? 0) > 0;
  const hasSlow = (towerCounts[WeaponType.SlowRocketLauncher] ?? 0) > 0;
  const hasAntiArmor = (towerCounts[WeaponType.RocketLauncher] ?? 0) + (towerCounts[WeaponType.NuclearLauncher] ?? 0) > 0;
  const hasSplit = (towerCounts[WeaponType.MultiRocketLauncher] ?? 0) > 0;
  const hasEnergy = (towerCounts[WeaponType.LaserTurret] ?? 0) + (towerCounts[WeaponType.ChainLightningTower] ?? 0) > 0;

  let score = 0;
  if (!hasBullet && towerType === WeaponType.BulletShooter) score += 1.6;
  if (context.waveNumber >= 4 && !hasFlame && towerType === WeaponType.FlameThrower) score += 2.6;
  if (!hasArea && towerType === WeaponType.GrenadeThrower) score += 2.2;
  if (context.waveNumber >= 9 && !hasSplit && towerType === WeaponType.MultiRocketLauncher) score += 2.2;
  if (context.waveNumber >= 6 && !hasChain && towerType === WeaponType.ChainLightningTower) score += 2.5;
  if (!hasSlow && towerType === WeaponType.SlowRocketLauncher) score += 2.4;
  if (!hasAntiArmor && (towerType === WeaponType.RocketLauncher || towerType === WeaponType.NuclearLauncher)) score += 1.8;
  if (context.waveNumber >= 8 && !hasEnergy && towerType === WeaponType.LaserTurret) score += 1.1;

  if (context.waveNumber >= 6 && towerType === WeaponType.GrenadeThrower) score += 0.6;
  if (context.waveNumber >= 5 && towerType === WeaponType.FlameThrower) score += 0.9;
  if (context.waveNumber >= 10 && towerType === WeaponType.MultiRocketLauncher) score += 0.9;
  if (context.waveNumber >= 8 && towerType === WeaponType.ChainLightningTower) score += 0.8;
  if (context.waveNumber >= 6 && towerType === WeaponType.SlowRocketLauncher) score += 0.8;

  return score;
}

function calculateTowerSpamPenalty(
  towerType: WeaponType,
  towerCounts: Partial<Record<WeaponType, number>>,
  waveNumber: number
): number {
  const count = towerCounts[towerType] ?? 0;
  if (count === 0) {
    return 0;
  }

  const basePenalty =
    towerType === WeaponType.BulletShooter
      ? 1.8
      : towerType === WeaponType.FlameThrower
        ? 1.6
      : towerType === WeaponType.MultiRocketLauncher
        ? 2
      : towerType === WeaponType.LaserTurret || towerType === WeaponType.NuclearLauncher || towerType === WeaponType.ChainLightningTower
        ? 2.2
        : 1.4;

  const waveScalar = waveNumber >= 8 ? 1.15 : 1;
  return count * basePenalty * waveScalar;
}

function calculateTowerCostPressurePenalty(context: PolicyContext, cost: number): number {
  const cheapestTower = Math.min(...context.balance.towers.map(tower => tower.cost));
  return Math.max(0, (cost - cheapestTower) / 22);
}

function calculateUpgradeSpamPenalty(
  towerType: WeaponType,
  towerCounts: Partial<Record<WeaponType, number>>,
  currentLevel: number,
  waveNumber: number
): number {
  const sameTypeCount = towerCounts[towerType] ?? 0;
  const premiumScalar =
    towerType === WeaponType.LaserTurret ||
    towerType === WeaponType.NuclearLauncher ||
    towerType === WeaponType.ChainLightningTower ||
    towerType === WeaponType.MultiRocketLauncher
      ? 1.4
      : 1;
  const levelPenalty = currentLevel >= 2 ? (currentLevel - 1) * 0.9 : 0;
  const compositionPenalty = sameTypeCount > 2 ? (sameTypeCount - 2) * 0.85 : 0;
  const earlyPremiumPenalty =
    waveNumber < 8 &&
    (towerType === WeaponType.LaserTurret ||
      towerType === WeaponType.NuclearLauncher ||
      towerType === WeaponType.ChainLightningTower ||
      towerType === WeaponType.MultiRocketLauncher ||
      towerType === WeaponType.RocketLauncher)
      ? 1.6
      : 0;

  return (levelPenalty + compositionPenalty + earlyPremiumPenalty) * premiumScalar;
}

function calculateEarlyExpansionUpgradePenalty(context: PolicyContext): number {
  const towerCount = context.weapons.length;
  if (context.waveNumber <= 2 && towerCount < 3) {
    return 1.2;
  }
  if (context.waveNumber <= 4 && towerCount < 4) {
    return 0.7;
  }
  return 0;
}
