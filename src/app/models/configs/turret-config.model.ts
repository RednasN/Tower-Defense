import { generatedBalanceConfig } from '../balance/generated-balance-config';
import { WeaponType } from '../weapons/weapon.model';
import {
  ArmorClass,
  BalanceConfig,
  ChainLightningConfig,
  DamageMultiplierMatrix,
  DamageType,
  EnemyConfig,
  EnemyType,
  FlameBubbleConfig,
  SplitRocketConfig,
  TurretConfig,
  UpgradeDetails,
  UpgradeLevelDetails,
  UpgradeType,
} from './balance-types';

const EASY_DAMAGE_TYPE_EFFECTIVENESS = {
  [DamageType.Bullet]: 1.4,
  [DamageType.Explosive]: 1.4,
  [DamageType.Energy]: 1.4,
  [DamageType.SlowExplosive]: 1.4,
} as const;

export {
  ArmorClass,
  BalanceConfig,
  ChainLightningConfig,
  DamageMultiplierMatrix,
  DamageType,
  EnemyConfig,
  EnemyType,
  FlameBubbleConfig,
  SplitRocketConfig,
  TurretConfig,
  UpgradeDetails,
  UpgradeLevelDetails,
  UpgradeType,
};

export const damageMultipliers: DamageMultiplierMatrix = generatedBalanceConfig.damageMultipliers;

export function getActiveBalanceConfig(): BalanceConfig {
  return generatedBalanceConfig;
}

export function getDamageMultiplier(damageType: DamageType, armorClass: ArmorClass): number {
  const base = damageMultipliers[damageType][armorClass] ?? 1;
  return base * (EASY_DAMAGE_TYPE_EFFECTIVENESS[damageType] ?? 1);
}

export function getDamageTypeForWeaponType(weaponType: WeaponType): DamageType {
  switch (weaponType) {
    case WeaponType.BulletShooter:
      return DamageType.Bullet;
    case WeaponType.RocketLauncher:
    case WeaponType.MultiRocketLauncher:
    case WeaponType.NuclearLauncher:
    case WeaponType.GrenadeThrower:
    case WeaponType.FlameThrower:
      return DamageType.Explosive;
    case WeaponType.SlowRocketLauncher:
      return DamageType.SlowExplosive;
    case WeaponType.ChainLightningTower:
    case WeaponType.LaserTurret:
      return DamageType.Energy;
    default:
      return DamageType.Bullet;
  }
}

export const enemyConfigs: EnemyConfig[] = generatedBalanceConfig.enemies;

export const basicEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.Basic)!;
export const fastAndWeakEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.FastAndWeak)!;
export const slowAndStrongEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.SlowAndStrong)!;
export const bossEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.Boss)!;
export const scoutTankEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.ScoutTank)!;
export const siegeTankEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.SiegeTank)!;
export const lightHovercraftEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.LightHovercraft)!;
export const heavyHovercraftEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.HeavyHovercraft)!;
export const fighterPlaneEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.FighterPlane)!;
export const bomberPlaneEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.BomberPlane)!;
export const interceptorDroneEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.InterceptorDrone)!;
export const juggernautMechEnemyConfig = enemyConfigs.find(config => config.type === EnemyType.JuggernautMech)!;

export const bulletShooterConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.BulletShooter)!;
export const flameThrowerConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.FlameThrower)!;
export const rocketLauncherConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.RocketLauncher)!;
export const multiRocketLauncherConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.MultiRocketLauncher)!;
export const chainLightningTowerConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.ChainLightningTower)!;
export const laserTurretConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.LaserTurret)!;
export const nuclearLauncherConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.NuclearLauncher)!;
export const slowRocketLauncherConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.SlowRocketLauncher)!;
export const grenadeThrowerConfig = generatedBalanceConfig.towers.find(config => config.type === WeaponType.GrenadeThrower)!;

export function getTurretConfigs(): TurretConfig[] {
  return [...generatedBalanceConfig.towers];
}

export function getEnemyConfigs(): EnemyConfig[] {
  return [...generatedBalanceConfig.enemies];
}

export function getTurretConfig(type: WeaponType): TurretConfig {
  const config = generatedBalanceConfig.towers.find(turretConfig => turretConfig.type === type);
  if (!config) {
    throw new Error('Invalid turret type');
  }

  return config;
}

export function getEnemyConfig(type: EnemyType): EnemyConfig {
  const config = generatedBalanceConfig.enemies.find(enemyConfig => enemyConfig.type === type);
  if (!config) {
    throw new Error('Invalid enemy type');
  }

  return config;
}
