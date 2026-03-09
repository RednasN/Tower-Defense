import { WeaponType } from '../weapons/weapon.model';

export type BalanceRuntimeConfig = {
  wave: {
    healthGrowth: number;
    speedGrowth: number;
    earlyHealthMultiplier: number;
    earlySpeedMultiplier: number;
    earlyWaves: number;
    rewardGrowth: number;
    countGrowth: number;
    spawnBaseMs: number;
    spawnDecayMs: number;
    spawnMinMs: number;
  };
  economy: {
    startMoney: number;
    reserveIntermissionBase: number;
    reserveIntermissionPerWave: number;
    reserveSpawningBase: number;
    reserveSpawningPerWave: number;
    reserveCleanupBase: number;
    reserveCleanupPerWave: number;
  };
  ai: {
    diversityPenalty: number;
    compositionStrength: number;
    upgradePreference: number;
    rangeUtilityPerLevel: number;
  };
  multipliers: {
    turretCostByType: Partial<Record<WeaponType, number>>;
    turretDamageByType: Partial<Record<WeaponType, number>>;
    turretSpeedByType: Partial<Record<WeaponType, number>>;
    damageTypeEffectiveness: {
      bullet: number;
      explosive: number;
      energy: number;
      slowExplosive: number;
    };
    upgradeCostMultiplier: number;
  };
};

export const DEFAULT_BALANCE_RUNTIME_CONFIG: BalanceRuntimeConfig = {
  wave: {
    healthGrowth: 0.06,
    speedGrowth: 0.008,
    earlyHealthMultiplier: 0.62,
    earlySpeedMultiplier: 0.82,
    earlyWaves: 4,
    rewardGrowth: 0.06,
    countGrowth: 1.2,
    spawnBaseMs: 1400,
    spawnDecayMs: 30,
    spawnMinMs: 420,
  },
  economy: {
    startMoney: 100,
    reserveIntermissionBase: 16,
    reserveIntermissionPerWave: 3,
    reserveSpawningBase: 24,
    reserveSpawningPerWave: 4,
    reserveCleanupBase: 15,
    reserveCleanupPerWave: 2,
  },
  ai: {
    diversityPenalty: 0.45,
    compositionStrength: 2.25,
    upgradePreference: 0.9,
    rangeUtilityPerLevel: 0.03,
  },
  multipliers: {
    turretCostByType: {
      [WeaponType.BulletShooter]: 1,
      [WeaponType.RocketLauncher]: 1,
      [WeaponType.LaserTurret]: 1,
      [WeaponType.SlowRocketLauncher]: 1,
      [WeaponType.NuclearLauncher]: 1,
      [WeaponType.GrenadeThrower]: 1,
      [WeaponType.Base]: 1,
      [WeaponType.MultiRocketLauncher]: 1,
    },
    turretDamageByType: {
      [WeaponType.BulletShooter]: 1,
      [WeaponType.RocketLauncher]: 1,
      [WeaponType.LaserTurret]: 1,
      [WeaponType.SlowRocketLauncher]: 1,
      [WeaponType.NuclearLauncher]: 1,
      [WeaponType.GrenadeThrower]: 1,
      [WeaponType.Base]: 1,
      [WeaponType.MultiRocketLauncher]: 1,
    },
    turretSpeedByType: {
      [WeaponType.BulletShooter]: 1,
      [WeaponType.RocketLauncher]: 1,
      [WeaponType.LaserTurret]: 1,
      [WeaponType.SlowRocketLauncher]: 1,
      [WeaponType.NuclearLauncher]: 1,
      [WeaponType.GrenadeThrower]: 1,
      [WeaponType.Base]: 1,
      [WeaponType.MultiRocketLauncher]: 1,
    },
    damageTypeEffectiveness: {
      bullet: 1,
      explosive: 1,
      energy: 1,
      slowExplosive: 1,
    },
    upgradeCostMultiplier: 1,
  },
};

import { generatedBalanceRuntimeConfig } from './balance-runtime-config.generated';

export const balanceRuntimeConfig: BalanceRuntimeConfig = generatedBalanceRuntimeConfig as BalanceRuntimeConfig;
