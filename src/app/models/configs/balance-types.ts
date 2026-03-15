/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { ProjectileType } from '../projectiles/projectile-type.model';
import { WeaponType } from '../weapons/weapon.model';

export enum UpgradeType {
  Range = 'range',
  Damage = 'damage',
  Speed = 'speed',
}

export enum ArmorClass {
  Light = 'light',
  Armored = 'armored',
  Swarm = 'swarm',
  Shielded = 'shielded',
}

export enum DamageType {
  Bullet = 'bullet',
  Explosive = 'explosive',
  Energy = 'energy',
  SlowExplosive = 'slowExplosive',
}

export type DamageMultiplierMatrix = Record<DamageType, Partial<Record<ArmorClass, number>>>;

export type UpgradeLevelDetails = {
  level: number;
  cost: number;
  value: number;
};

export type UpgradeDetails = {
  type: UpgradeType;
  details: UpgradeLevelDetails[];
};

export type ChainLightningConfig = {
  chainCount: number;
  chainRadius: number;
  damageFalloff: number;
  durationTicks: number;
};

export type FlameBubbleConfig = {
  lifetimeMs: number;
  hitRadius: number;
  visualScale: number;
  bubblesPerShot: number;
  spreadDegrees: number;
};

export type SplitRocketConfig = {
  splitDelayMs: number;
  childRocketCount: number;
  childSearchRadius: number;
  childDamageMultiplier: number;
  childSpeedMultiplier: number;
};

export type TurretConfig = {
  imageSrc: string;
  cost: number;
  type: WeaponType;
  projectileType: ProjectileType;
  projectileSpeed: number | null;
  upgrades: UpgradeDetails[];
  chainLightning?: ChainLightningConfig;
  flameBubble?: FlameBubbleConfig;
  splitRocket?: SplitRocketConfig;
};

export enum EnemyType {
  Basic = 'basic',
  FastAndWeak = 'fastAndWeak',
  SlowAndStrong = 'slowAndStrong',
  Boss = 'boss',
  ScoutTank = 'scoutTank',
  SiegeTank = 'siegeTank',
  LightHovercraft = 'lightHovercraft',
  HeavyHovercraft = 'heavyHovercraft',
  FighterPlane = 'fighterPlane',
  BomberPlane = 'bomberPlane',
  InterceptorDrone = 'interceptorDrone',
  JuggernautMech = 'juggernautMech',
}

export type EnemyConfig = {
  type: EnemyType;
  health: number;
  speed: number;
  reward: number;
  imageName: string;
  armorClass: ArmorClass;
  threat: number;
  unlockWave: number;
  weight: number;
  baseDamageToBase: number;
};

export type EconomyBalanceConfig = {
  startingMoney: number;
  startingBaseHealth: number;
  hoardPenaltyThresholdMultiplier: number;
};

export type WaveBalanceConfig = {
  initialWaveCountdownMs: number;
  waveDurationMs: number;
  budgetBase: number;
  budgetGrowthLinear: number;
  budgetGrowthPower: number;
  budgetGrowthFactor: number;
  eliteWeightBoostPerWave: number;
  maxEnemiesPerWave: number;
  adaptivePressureBudgetMultiplier?: number;
  adaptivePressureSpawnIntervalMultiplier?: number;
  adaptivePressureEliteWeightMultiplier?: number;
};

export type BalanceConfig = {
  economy: EconomyBalanceConfig;
  damageMultipliers: DamageMultiplierMatrix;
  towers: TurretConfig[];
  enemies: EnemyConfig[];
  waves: WaveBalanceConfig;
};
