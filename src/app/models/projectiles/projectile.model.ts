import { DamageType } from '../configs/turret-config.model';
import { ProjectileType } from './projectile-type.model';

/* eslint-disable @typescript-eslint/consistent-type-definitions */
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
  speed: number;
  isChild: boolean;
  hasSplit: boolean;
  splitDelayRemainingMs: number | null;
  childRocketCount: number;
  childSearchRadius: number;
  childDamageMultiplier: number;
  childSpeedMultiplier: number;
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

export type FlameBubble = BaseProjectTile & {
  type: ProjectileType.FlameBubble;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  angle: number;
  speed: number;
  remainingMs: number;
  hitRadius: number;
  scale: number;
  hitEnemyIndexes: number[];
};

export type Laser = BaseProjectTile & {
  type: ProjectileType.Laser;
  gridY: number;
  gridX: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  enemyIndex: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  angle: number | null;
  duration: number;
  laserParts: LaserPart[];
};

export type ChainLightning = BaseProjectTile & {
  type: ProjectileType.ChainLightning;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  enemyIndex: number;
  needdraw: boolean;
  damage: number;
  damageType: DamageType;
  duration: number;
  applied: boolean;
  segments: LightningSegment[];
  hits: ChainLightningHit[];
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

export type LightningSegment = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type ChainLightningHit = {
  enemyIndex: number;
  damageMultiplier: number;
};

export type Projectile = Rocket | Bullet | FlameBubble | Laser | ChainLightning | Grenade;
