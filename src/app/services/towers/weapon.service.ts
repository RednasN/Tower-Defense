import { delta } from '../../models/constants';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { Weapon, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';

import { TurretConfigService } from './turret-config.service';

export abstract class WeaponService {
  abstract shoot(weapon: Weapon): void;

  constructor(
    protected readonly gridService: GridService,
    protected readonly canvasService: CanvasService,
    protected readonly enemyService: EnemyService,
    protected readonly turretConfigService: TurretConfigService
  ) {}

  public create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): Weapon {
    return {
      type: WeaponType.Base,
      rangeLevel,
      powerLevel,
      speedLevel,
      damage: 0,
      range: 0,
      speed: 0,
      gridX: x,
      gridY: y,
      focusedIndex: -1,
      focusedIndexes: [],
      startx: null,
      starty: null,
      lastFired: 99999,
      angle: 0,
      locked: false,
    };
  }

  public setStats(weapon: Weapon): void {
    const stats = this.turretConfigService.getTurretSpecification(weapon.type, weapon.speedLevel, weapon.rangeLevel, weapon.powerLevel);
    weapon.damage = stats.damage;
    weapon.speed = stats.speed;
    weapon.range = stats.range;
  }

  protected getProjectileMetadata(weaponType: WeaponType): { projectileType: ProjectileType; projectileSpeed: number | null } {
    const turretConfig = this.turretConfigService.getTurretConfig(weaponType);

    return {
      projectileType: turretConfig.projectileType,
      projectileSpeed: turretConfig.projectileSpeed,
    };
  }

  protected requireProjectileSpeed(weaponType: WeaponType): number {
    const { projectileSpeed } = this.getProjectileMetadata(weaponType);
    if (projectileSpeed === null) {
      throw new Error(`Turret ${weaponType} requires a projectile speed.`);
    }

    return projectileSpeed;
  }

  protected requireBulletProjectileType(
    weaponType: WeaponType
  ): ProjectileType.Bullet | ProjectileType.SlowRocket | ProjectileType.NuclearBullet {
    const { projectileType } = this.getProjectileMetadata(weaponType);
    if (
      projectileType !== ProjectileType.Bullet &&
      projectileType !== ProjectileType.SlowRocket &&
      projectileType !== ProjectileType.NuclearBullet
    ) {
      throw new Error(`Turret ${weaponType} requires a bullet-like projectile type.`);
    }

    return projectileType;
  }

  public canShoot(weapon: Weapon): void {
    weapon.lastFired += delta * 1000;

    if (weapon.focusedIndex !== -1) {
      if (weapon.lastFired > weapon.speed) {
        this.shoot(weapon);
        weapon.lastFired = 0;
      }
    }
  }

  public findClosests(weapon: Weapon) {
    if (weapon.focusedIndexes.length === 0) {
      for (let i = 0; i < this.enemyService.enemies.length; i++) {
        if (this.isInRange(weapon, i)) {
          weapon.focusedIndexes.push(i);
        }
      }
    }
  }

  public calculate(weapon: Weapon): void {
    weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;

    this.findClosest(weapon);

    if (weapon.focusedIndex !== -1 && !this.isInRange(weapon, weapon.focusedIndex)) {
      weapon.focusedIndex = -1;
      weapon.locked = false;
    }

    if (weapon.focusedIndex !== -1) {
      const cellHeight = this.gridService.grid[weapon.gridX][weapon.gridY].height / 2;
      const cellWidth = this.gridService.grid[weapon.gridX][weapon.gridY].width / 2;

      const enemeyCenterX = this.enemyService.enemies[weapon.focusedIndex].drawx + this.canvasService.mainCanvasXOffset + cellWidth;
      const enemeyCenterY = this.enemyService.enemies[weapon.focusedIndex].drawy + this.canvasService.mainCanvasYOffset + cellHeight;

      const turretCenterX = weapon.startx! + cellWidth;
      const turretCenterY = weapon.starty! + cellHeight;

      const deltaX = turretCenterX - enemeyCenterX;
      const deltaY = turretCenterY - enemeyCenterY;

      const rad = Math.atan2(deltaY, deltaX);

      const angleDest = Math.round((rad * 180) / Math.PI + 180);

      if (!weapon.locked) {
        let diff = angleDest - weapon.angle;
        if (diff < 0) {
          diff += 360;
        }
        if (diff > 180) {
          weapon.angle += -(250 * delta);

          if (weapon.angle < 0) {
            weapon.angle = 359;
          }
        } else {
          weapon.angle += 250 * delta;
          if (weapon.angle > 359) {
            weapon.angle = 0;
          }
        }
      } else {
        weapon.angle = angleDest;
        if (weapon.angle > 359) {
          weapon.angle = 0;
        }

        if (weapon.angle < 0) {
          weapon.angle = 359;
        }
      }

      if (Math.abs(angleDest - weapon.angle) < 5) {
        weapon.locked = true;
      }

      if (weapon.locked) {
        this.canShoot(weapon);
      }
    }
  }

  public findClosest(weapon: Weapon): void {
    if (weapon.focusedIndex === -1) {
      let shortestRoute = -1;
      let shortestIndex = -1;

      for (let i = 0; i < this.enemyService.enemies.length; i++) {
        if (this.isInRange(weapon, i)) {
          if (shortestRoute === -1 && shortestIndex === -1) {
            shortestRoute = this.enemyService.enemies[i].routeindex;
            shortestIndex = i;
          }

          if (this.enemyService.enemies[i].routeindex > shortestRoute) {
            shortestRoute = this.enemyService.enemies[i].routeindex;
            shortestIndex = i;
          }
        }
      }

      if (shortestIndex !== -1) {
        weapon.focusedIndex = shortestIndex;
      }
    }
  }

  public isInRange(weapon: Weapon, i: number): boolean {
    if (this.enemyService.enemies[i].lives <= 0) {
      return false;
    }

    const startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    const starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;

    const cellWidth = this.gridService.grid[weapon.gridX][weapon.gridY].width / 2;
    const cellHeight = this.gridService.grid[weapon.gridX][weapon.gridY].height / 2;

    const x0 = startx + cellWidth;
    const y0 = starty + cellHeight;

    const x1 = this.enemyService.enemies[i].drawx + this.canvasService.mainCanvasXOffset + cellWidth;
    const y1 = this.enemyService.enemies[i].drawy + this.canvasService.mainCanvasYOffset + cellHeight;

    if (Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) < weapon.range) {
      //initiate.
      return true;
    }

    return false;
  }
}
