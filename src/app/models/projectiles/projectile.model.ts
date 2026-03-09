import { DamageType } from '../configs/turret-config.model';

/* eslint-disable @typescript-eslint/consistent-type-definitions */
export enum ProjectileType {
  Base = 'Base',
  Rocket = 'Rocket',
  Bullet = 'Bullet',
  Laser = 'Laser',
  NuclearBullet = 'NuclearBullet',
  SlowRocket = 'SlowRocket',
  GrenadeMine = 'GrenadeMine',
}

export type BaseProjectTile = {
  type: ProjectileType;
};

export type Rocket = BaseProjectTile & {
  type: ProjectileType.Rocket;
  gridY: number;
  gridX: number;
  x: number;
  y: number;
  enemyIndex: number;
  angle: number;
  locked: boolean;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  plusrotation: boolean | null;
  steps: number;
};

export type Bullet = BaseProjectTile & {
  type: ProjectileType.Bullet | ProjectileType.SlowRocket | ProjectileType.NuclearBullet;
  gridY: number;
  gridX: number;
  x: number;
  y: number;
  enemyIndex: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  angle: number | null;
  speed: number;
};

export type Laser = BaseProjectTile & {
  type: ProjectileType.Laser;
  gridY: number;
  gridX: number;
  x: number;
  y: number;
  enemyIndex: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  angle: number | null;
  duration: number;
  laserParts: LaserPart[];
};

export type Grenade = BaseProjectTile & {
  type: ProjectileType.GrenadeMine;
  gridY: number;
  gridX: number;
  x: number;
  y: number;
  enemyIndex: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  angle: number | null;
  speed: number;
  targetX: number;
  targetY: number;
  isArmed: boolean;
  blinkTimerMs: number;
  blastRadius: number;
  triggerRadius: number;
  lifeTimeMs: number;
};

export type LaserPart = {
  x: number;
  y: number;
};

export type Projectile = Rocket | Bullet | Laser | Grenade;
