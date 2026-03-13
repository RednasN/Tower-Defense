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

const EASY_DAMAGE_TYPE_EFFECTIVENESS = {
  [DamageType.Bullet]: 1.4,
  [DamageType.Explosive]: 1.4,
  [DamageType.Energy]: 1.4,
  [DamageType.SlowExplosive]: 1.4,
} as const;

export type DamageMultiplierMatrix = Record<DamageType, Partial<Record<ArmorClass, number>>>;

export const damageMultipliers: DamageMultiplierMatrix = {
  [DamageType.Bullet]: {
    [ArmorClass.Light]: 1.2,
    [ArmorClass.Armored]: 0.7,
    [ArmorClass.Swarm]: 0.95,
    [ArmorClass.Shielded]: 0.8,
  },
  [DamageType.Explosive]: {
    [ArmorClass.Light]: 0.95,
    [ArmorClass.Armored]: 1.1,
    [ArmorClass.Swarm]: 1.35,
    [ArmorClass.Shielded]: 0.9,
  },
  [DamageType.Energy]: {
    [ArmorClass.Light]: 0.95,
    [ArmorClass.Armored]: 1.35,
    [ArmorClass.Swarm]: 0.9,
    [ArmorClass.Shielded]: 1.25,
  },
  [DamageType.SlowExplosive]: {
    [ArmorClass.Light]: 1,
    [ArmorClass.Armored]: 1.1,
    [ArmorClass.Swarm]: 1.15,
    [ArmorClass.Shielded]: 1,
  },
};

export function getDamageMultiplier(damageType: DamageType, armorClass: ArmorClass): number {
  const base = damageMultipliers[damageType][armorClass] ?? 1;
  return base * (EASY_DAMAGE_TYPE_EFFECTIVENESS[damageType] ?? 1);
}

export function getDamageTypeForWeaponType(weaponType: WeaponType): DamageType {
  switch (weaponType) {
    case WeaponType.BulletShooter:
      return DamageType.Bullet;
    case WeaponType.RocketLauncher:
    case WeaponType.NuclearLauncher:
    case WeaponType.GrenadeThrower:
      return DamageType.Explosive;
    case WeaponType.SlowRocketLauncher:
      return DamageType.SlowExplosive;
    case WeaponType.LaserTurret:
      return DamageType.Energy;
    default:
      return DamageType.Bullet;
  }
}

export type UpgradeLevelDetails = {
  level: number;
  cost: number;
  value: number;
};

export type UpgradeDetails = {
  type: UpgradeType;
  details: UpgradeLevelDetails[];
};

export type TurretConfig = {
  imageSrc: string;
  cost: number;
  type: WeaponType;
  projectileType: ProjectileType;
  projectileSpeed: number | null;
  upgrades: UpgradeDetails[];
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
}

export type EnemyConfig = {
  type: EnemyType;
  health: number;
  speed: number;
  reward: number;
  imageName: string;
  armorClass: ArmorClass;
};

export const basicEnemyConfig: EnemyConfig = {
  type: EnemyType.Basic,
  health: 10,
  speed: 145,
  reward: 10,
  imageName: 'BasicEnemy',
  armorClass: ArmorClass.Light,
};

export const fastAndWeakEnemyConfig: EnemyConfig = {
  type: EnemyType.FastAndWeak,
  health: 16,
  speed: 180,
  reward: 12,
  imageName: 'FastAndWeakEnemy',
  armorClass: ArmorClass.Swarm,
};

export const slowAndStrongEnemyConfig: EnemyConfig = {
  type: EnemyType.SlowAndStrong,
  health: 34,
  speed: 108,
  reward: 20,
  imageName: 'SlowAndStrongEnemy',
  armorClass: ArmorClass.Armored,
};

export const bossEnemyConfig: EnemyConfig = {
  type: EnemyType.Boss,
  health: 48,
  speed: 92,
  reward: 28,
  imageName: 'BossEnemy',
  armorClass: ArmorClass.Shielded,
};

export const scoutTankEnemyConfig: EnemyConfig = {
  type: EnemyType.ScoutTank,
  health: 54,
  speed: 138,
  reward: 30,
  imageName: 'ScoutTankEnemy',
  armorClass: ArmorClass.Light,
};

export const siegeTankEnemyConfig: EnemyConfig = {
  type: EnemyType.SiegeTank,
  health: 70,
  speed: 90,
  reward: 38,
  imageName: 'SiegeTankEnemy',
  armorClass: ArmorClass.Armored,
};

export const lightHovercraftEnemyConfig: EnemyConfig = {
  type: EnemyType.LightHovercraft,
  health: 62,
  speed: 152,
  reward: 40,
  imageName: 'LightHovercraftEnemy',
  armorClass: ArmorClass.Swarm,
};

export const heavyHovercraftEnemyConfig: EnemyConfig = {
  type: EnemyType.HeavyHovercraft,
  health: 88,
  speed: 106,
  reward: 48,
  imageName: 'HeavyHovercraftEnemy',
  armorClass: ArmorClass.Armored,
};

export const fighterPlaneEnemyConfig: EnemyConfig = {
  type: EnemyType.FighterPlane,
  health: 82,
  speed: 178,
  reward: 54,
  imageName: 'FighterPlaneEnemy',
  armorClass: ArmorClass.Swarm,
};

export const bomberPlaneEnemyConfig: EnemyConfig = {
  type: EnemyType.BomberPlane,
  health: 110,
  speed: 128,
  reward: 64,
  imageName: 'BomberPlaneEnemy',
  armorClass: ArmorClass.Shielded,
};

export const enemyConfigs: EnemyConfig[] = [
  basicEnemyConfig,
  fastAndWeakEnemyConfig,
  slowAndStrongEnemyConfig,
  bossEnemyConfig,
  scoutTankEnemyConfig,
  siegeTankEnemyConfig,
  lightHovercraftEnemyConfig,
  heavyHovercraftEnemyConfig,
  fighterPlaneEnemyConfig,
  bomberPlaneEnemyConfig,
];

const standardUpgradeCosts = [8, 12, 18, 26, 36];

export const rocketLauncherConfig: TurretConfig = {
  type: WeaponType.RocketLauncher,
  imageSrc: './assets/turrets/rocket-launcher-basic.png',
  cost: 35,
  projectileType: ProjectileType.Rocket,
  projectileSpeed: 125,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 170 },
        { level: 2, cost: standardUpgradeCosts[1], value: 195 },
        { level: 3, cost: standardUpgradeCosts[2], value: 220 },
        { level: 4, cost: standardUpgradeCosts[3], value: 255 },
        { level: 5, cost: standardUpgradeCosts[4], value: 290 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 3.3 },
        { level: 2, cost: standardUpgradeCosts[1], value: 4.2 },
        { level: 3, cost: standardUpgradeCosts[2], value: 5.1 },
        { level: 4, cost: standardUpgradeCosts[3], value: 6.3 },
        { level: 5, cost: standardUpgradeCosts[4], value: 7.5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1800 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1650 },
        { level: 3, cost: standardUpgradeCosts[2], value: 1500 },
        { level: 4, cost: standardUpgradeCosts[3], value: 1360 },
        { level: 5, cost: standardUpgradeCosts[4], value: 1220 },
      ],
    },
  ],
};

export const bulletShooterConfig: TurretConfig = {
  type: WeaponType.BulletShooter,
  imageSrc: './assets/turrets/turret.png',
  cost: 25,
  projectileType: ProjectileType.Bullet,
  projectileSpeed: 250,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 145 },
        { level: 2, cost: standardUpgradeCosts[1], value: 165 },
        { level: 3, cost: standardUpgradeCosts[2], value: 185 },
        { level: 4, cost: standardUpgradeCosts[3], value: 205 },
        { level: 5, cost: standardUpgradeCosts[4], value: 225 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1.6 },
        { level: 2, cost: standardUpgradeCosts[1], value: 2.1 },
        { level: 3, cost: standardUpgradeCosts[2], value: 2.7 },
        { level: 4, cost: standardUpgradeCosts[3], value: 3.4 },
        { level: 5, cost: standardUpgradeCosts[4], value: 4.2 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1400 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1250 },
        { level: 3, cost: standardUpgradeCosts[2], value: 1120 },
        { level: 4, cost: standardUpgradeCosts[3], value: 1000 },
        { level: 5, cost: standardUpgradeCosts[4], value: 900 },
      ],
    },
  ],
};

export const laserTurretConfig: TurretConfig = {
  type: WeaponType.LaserTurret,
  imageSrc: './assets/turrets/laser-shooter.png',
  cost: 38,
  projectileType: ProjectileType.Laser,
  projectileSpeed: null,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 160 },
        { level: 2, cost: standardUpgradeCosts[1], value: 182 },
        { level: 3, cost: standardUpgradeCosts[2], value: 205 },
        { level: 4, cost: standardUpgradeCosts[3], value: 228 },
        { level: 5, cost: standardUpgradeCosts[4], value: 250 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 2.4 },
        { level: 2, cost: standardUpgradeCosts[1], value: 3.1 },
        { level: 3, cost: standardUpgradeCosts[2], value: 3.9 },
        { level: 4, cost: standardUpgradeCosts[3], value: 4.8 },
        { level: 5, cost: standardUpgradeCosts[4], value: 5.8 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1200 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1080 },
        { level: 3, cost: standardUpgradeCosts[2], value: 980 },
        { level: 4, cost: standardUpgradeCosts[3], value: 900 },
        { level: 5, cost: standardUpgradeCosts[4], value: 820 },
      ],
    },
  ],
};

export const slowRocketLauncherConfig: TurretConfig = {
  type: WeaponType.SlowRocketLauncher,
  imageSrc: './assets/turrets/slow-turret.png',
  cost: 33,
  projectileType: ProjectileType.SlowRocket,
  projectileSpeed: 250,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 210 },
        { level: 2, cost: standardUpgradeCosts[1], value: 240 },
        { level: 3, cost: standardUpgradeCosts[2], value: 270 },
        { level: 4, cost: standardUpgradeCosts[3], value: 305 },
        { level: 5, cost: standardUpgradeCosts[4], value: 340 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1.8 },
        { level: 2, cost: standardUpgradeCosts[1], value: 2.3 },
        { level: 3, cost: standardUpgradeCosts[2], value: 2.9 },
        { level: 4, cost: standardUpgradeCosts[3], value: 3.6 },
        { level: 5, cost: standardUpgradeCosts[4], value: 4.4 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1300 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1180 },
        { level: 3, cost: standardUpgradeCosts[2], value: 1070 },
        { level: 4, cost: standardUpgradeCosts[3], value: 970 },
        { level: 5, cost: standardUpgradeCosts[4], value: 880 },
      ],
    },
  ],
};

export const nuclearLauncherConfig: TurretConfig = {
  type: WeaponType.NuclearLauncher,
  cost: 50,
  imageSrc: './assets/turrets/nuclear-turret.png',
  projectileType: ProjectileType.NuclearBullet,
  projectileSpeed: 500,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 170 },
        { level: 2, cost: standardUpgradeCosts[1], value: 197 },
        { level: 3, cost: standardUpgradeCosts[2], value: 225 },
        { level: 4, cost: standardUpgradeCosts[3], value: 252 },
        { level: 5, cost: standardUpgradeCosts[4], value: 280 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 5 },
        { level: 2, cost: standardUpgradeCosts[1], value: 6.4 },
        { level: 3, cost: standardUpgradeCosts[2], value: 7.9 },
        { level: 4, cost: standardUpgradeCosts[3], value: 9.5 },
        { level: 5, cost: standardUpgradeCosts[4], value: 11.2 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1900 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1760 },
        { level: 3, cost: standardUpgradeCosts[2], value: 1620 },
        { level: 4, cost: standardUpgradeCosts[3], value: 1480 },
        { level: 5, cost: standardUpgradeCosts[4], value: 1360 },
      ],
    },
  ],
};

export const grenadeThrowerConfig: TurretConfig = {
  type: WeaponType.GrenadeThrower,
  imageSrc: './assets/turrets/grenade-thrower.png',
  cost: 32,
  projectileType: ProjectileType.GrenadeMine,
  projectileSpeed: null,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 140 },
        { level: 2, cost: standardUpgradeCosts[1], value: 160 },
        { level: 3, cost: standardUpgradeCosts[2], value: 185 },
        { level: 4, cost: standardUpgradeCosts[3], value: 210 },
        { level: 5, cost: standardUpgradeCosts[4], value: 235 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 2.8 },
        { level: 2, cost: standardUpgradeCosts[1], value: 3.7 },
        { level: 3, cost: standardUpgradeCosts[2], value: 4.8 },
        { level: 4, cost: standardUpgradeCosts[3], value: 6 },
        { level: 5, cost: standardUpgradeCosts[4], value: 7.3 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: standardUpgradeCosts[0], value: 1700 },
        { level: 2, cost: standardUpgradeCosts[1], value: 1550 },
        { level: 3, cost: standardUpgradeCosts[2], value: 1410 },
        { level: 4, cost: standardUpgradeCosts[3], value: 1280 },
        { level: 5, cost: standardUpgradeCosts[4], value: 1160 },
      ],
    },
  ],
};

export function getTurretConfigs(): TurretConfig[] {
  const configs = [
    bulletShooterConfig,
    rocketLauncherConfig,
    laserTurretConfig,
    nuclearLauncherConfig,
    slowRocketLauncherConfig,
    grenadeThrowerConfig,
  ];

  return configs;
}

export function getTurretConfig(type: WeaponType): TurretConfig {
  const resolveBaseConfig = (): TurretConfig => {
    switch (type) {
      case WeaponType.BulletShooter:
        return bulletShooterConfig;
      case WeaponType.RocketLauncher:
        return rocketLauncherConfig;
      case WeaponType.LaserTurret:
        return laserTurretConfig;
      case WeaponType.NuclearLauncher:
        return nuclearLauncherConfig;
      case WeaponType.SlowRocketLauncher:
        return slowRocketLauncherConfig;
      case WeaponType.GrenadeThrower:
        return grenadeThrowerConfig;
      default:
        throw new Error('Invalid turret type');
    }
  };

  return resolveBaseConfig();
}
