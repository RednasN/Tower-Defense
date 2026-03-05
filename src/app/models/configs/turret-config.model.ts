/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { WeaponType } from '../weapons/weapon.model';

export enum UpgradeType {
  Range = 'range',
  Damage = 'damage',
  Speed = 'speed',
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
};

export const basicEnemyConfig: EnemyConfig = {
  type: EnemyType.Basic,
  health: 10,
  speed: 150,
  reward: 10,
  imageName: 'BasicEnemy',
};

export const fastAndWeakEnemyConfig: EnemyConfig = {
  type: EnemyType.FastAndWeak,
  health: 20,
  speed: 170,
  reward: 12,
  imageName: 'FastAndWeakEnemy',
};

export const slowAndStrongEnemyConfig: EnemyConfig = {
  type: EnemyType.SlowAndStrong,
  health: 30,
  speed: 115,
  reward: 18,
  imageName: 'SlowAndStrongEnemy',
};

export const bossEnemyConfig: EnemyConfig = {
  type: EnemyType.Boss,
  health: 40,
  speed: 95,
  reward: 24,
  imageName: 'BossEnemy',
};

export const scoutTankEnemyConfig: EnemyConfig = {
  type: EnemyType.ScoutTank,
  health: 50,
  speed: 135,
  reward: 28,
  imageName: 'ScoutTankEnemy',
};

export const siegeTankEnemyConfig: EnemyConfig = {
  type: EnemyType.SiegeTank,
  health: 60,
  speed: 90,
  reward: 34,
  imageName: 'SiegeTankEnemy',
};

export const lightHovercraftEnemyConfig: EnemyConfig = {
  type: EnemyType.LightHovercraft,
  health: 70,
  speed: 145,
  reward: 38,
  imageName: 'LightHovercraftEnemy',
};

export const heavyHovercraftEnemyConfig: EnemyConfig = {
  type: EnemyType.HeavyHovercraft,
  health: 80,
  speed: 105,
  reward: 44,
  imageName: 'HeavyHovercraftEnemy',
};

export const fighterPlaneEnemyConfig: EnemyConfig = {
  type: EnemyType.FighterPlane,
  health: 90,
  speed: 175,
  reward: 50,
  imageName: 'FighterPlaneEnemy',
};

export const bomberPlaneEnemyConfig: EnemyConfig = {
  type: EnemyType.BomberPlane,
  health: 100,
  speed: 125,
  reward: 58,
  imageName: 'BomberPlaneEnemy',
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

export const rocketLauncherConfig: TurretConfig = {
  type: WeaponType.RocketLauncher,
  imageSrc: './assets/turrets/rocket-launcher-basic.png',
  cost: 25,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 150 },
        { level: 2, cost: 20, value: 175 },
        { level: 3, cost: 30, value: 200 },
        { level: 4, cost: 40, value: 225 },
        { level: 5, cost: 50, value: 250 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 1 },
        { level: 2, cost: 20, value: 2 },
        { level: 3, cost: 30, value: 3 },
        { level: 4, cost: 40, value: 4 },
        { level: 5, cost: 50, value: 5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 1500 },
        { level: 2, cost: 20, value: 1400 },
        { level: 3, cost: 30, value: 1300 },
        { level: 4, cost: 40, value: 1250 },
        { level: 5, cost: 50, value: 200 },
      ],
    },
  ],
};

export const bulletShooterConfig: TurretConfig = {
  type: WeaponType.BulletShooter,
  imageSrc: './assets/turrets/turret.png',
  cost: 25,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 150 },
        { level: 2, cost: 20, value: 175 },
        { level: 3, cost: 30, value: 200 },
        { level: 4, cost: 40, value: 225 },
        { level: 5, cost: 50, value: 250 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 1 },
        { level: 2, cost: 20, value: 2 },
        { level: 3, cost: 30, value: 3 },
        { level: 4, cost: 40, value: 4 },
        { level: 5, cost: 50, value: 5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 2000 },
        { level: 2, cost: 20, value: 1750 },
        { level: 3, cost: 30, value: 1500 },
        { level: 4, cost: 40, value: 1250 },
        { level: 5, cost: 50, value: 1000 },
      ],
    },
  ],
};

export const laserTurretConfig: TurretConfig = {
  type: WeaponType.LaserTurret,
  imageSrc: './assets/turrets/laser-shooter.png',
  cost: 25,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 150 },
        { level: 2, cost: 20, value: 175 },
        { level: 3, cost: 30, value: 200 },
        { level: 4, cost: 40, value: 225 },
        { level: 5, cost: 50, value: 250 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 1 },
        { level: 2, cost: 20, value: 2 },
        { level: 3, cost: 30, value: 3 },
        { level: 4, cost: 40, value: 4 },
        { level: 5, cost: 50, value: 5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 2000 },
        { level: 2, cost: 20, value: 1750 },
        { level: 3, cost: 30, value: 1500 },
        { level: 4, cost: 40, value: 1250 },
        { level: 5, cost: 50, value: 1000 },
      ],
    },
  ],
};

export const slowRocketLauncherConfig: TurretConfig = {
  type: WeaponType.SlowRocketLauncher,
  imageSrc: './assets/turrets/slow-turret.png',
  cost: 25,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 300 },
        { level: 2, cost: 20, value: 350 },
        { level: 3, cost: 30, value: 400 },
        { level: 4, cost: 40, value: 450 },
        { level: 5, cost: 50, value: 500 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 1 },
        { level: 2, cost: 20, value: 2 },
        { level: 3, cost: 30, value: 3 },
        { level: 4, cost: 40, value: 4 },
        { level: 5, cost: 50, value: 5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 2000 },
        { level: 2, cost: 20, value: 1750 },
        { level: 3, cost: 30, value: 1500 },
        { level: 4, cost: 40, value: 1300 },
        { level: 5, cost: 50, value: 1200 },
      ],
    },
  ],
};

export const nuclearLauncherConfig: TurretConfig = {
  type: WeaponType.NuclearLauncher,
  cost: 25,
  imageSrc: './assets/turrets/nuclear-turret.png',
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 150 },
        { level: 2, cost: 20, value: 175 },
        { level: 3, cost: 30, value: 200 },
        { level: 4, cost: 40, value: 225 },
        { level: 5, cost: 50, value: 250 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 1 },
        { level: 2, cost: 20, value: 2 },
        { level: 3, cost: 30, value: 3 },
        { level: 4, cost: 40, value: 4 },
        { level: 5, cost: 50, value: 5 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 2000 },
        { level: 2, cost: 20, value: 1750 },
        { level: 3, cost: 30, value: 1500 },
        { level: 4, cost: 40, value: 1250 },
        { level: 5, cost: 50, value: 1000 },
      ],
    },
  ],
};

export const grenadeThrowerConfig: TurretConfig = {
  type: WeaponType.GrenadeThrower,
  imageSrc: './assets/turrets/grenade-thrower.png',
  cost: 30,
  upgrades: [
    {
      type: UpgradeType.Range,
      details: [
        { level: 1, cost: 10, value: 130 },
        { level: 2, cost: 20, value: 150 },
        { level: 3, cost: 30, value: 180 },
        { level: 4, cost: 40, value: 210 },
        { level: 5, cost: 50, value: 240 },
      ],
    },
    {
      type: UpgradeType.Damage,
      details: [
        { level: 1, cost: 10, value: 2 },
        { level: 2, cost: 20, value: 3 },
        { level: 3, cost: 30, value: 4 },
        { level: 4, cost: 40, value: 5 },
        { level: 5, cost: 50, value: 6 },
      ],
    },
    {
      type: UpgradeType.Speed,
      details: [
        { level: 1, cost: 10, value: 2200 },
        { level: 2, cost: 20, value: 2000 },
        { level: 3, cost: 30, value: 1800 },
        { level: 4, cost: 40, value: 1600 },
        { level: 5, cost: 50, value: 1400 },
      ],
    },
  ],
};

export function getTurretConfigs(): TurretConfig[] {
  return [
    bulletShooterConfig,
    rocketLauncherConfig,
    laserTurretConfig,
    nuclearLauncherConfig,
    slowRocketLauncherConfig,
    grenadeThrowerConfig,
  ];
}

export function getTurretConfig(type: WeaponType): TurretConfig {
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
}
