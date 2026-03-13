import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { delta } from '../../models/constants';
import { type Grenade } from '../../models/projectiles/projectile.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { WeaponType, type GrenadeThrower } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { GrenadeService } from '../projectiles/grenade.service';
import { ProjectileService } from '../projectiles/projectile.service';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class GrenadeThrowerService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly grenadeService = inject(GrenadeService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): GrenadeThrower {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);

    const weapon: GrenadeThrower = {
      ...baseWeapon,
      type: WeaponType.GrenadeThrower,
      angle: Math.floor(Math.random() * 360),
    };

    this.setStats(weapon);
    return weapon;
  }

  public override calculate(weapon: GrenadeThrower): void {
    weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;
    weapon.angle += 30 * delta;
    if (weapon.angle > 359) {
      weapon.angle = 0;
    }

    weapon.lastFired += delta * 1000;
    if (weapon.lastFired > weapon.speed) {
      this.shoot(weapon);
      weapon.lastFired = 0;
    }
  }

  public shoot(weapon: GrenadeThrower): void {
    const { projectileType, projectileSpeed } = this.getProjectileMetadata(weapon.type);
    if (projectileSpeed !== null) {
      throw new Error(`Grenade thrower ${weapon.type} should not define a projectile speed.`);
    }

    const towerCenterX = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + 25;
    const towerCenterY = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + 25;

    const inRangePathCells = this.gridService.route.filter(routeCell => {
      const routeCenterX = routeCell.drawx + 25;
      const routeCenterY = routeCell.drawy + 25;
      return Math.hypot(routeCenterX - towerCenterX, routeCenterY - towerCenterY) <= weapon.range;
    });

    if (inRangePathCells.length === 0) {
      return;
    }

    const activeMines = this.projectileService.projectiles.filter(
      (projectile): projectile is Grenade =>
        projectile.type === ProjectileType.GrenadeMine && projectile.needdraw && (projectile.isArmed || projectile.speed > 0)
    );

    const freePathCells = inRangePathCells.filter(routeCell => {
      const routeCenterX = routeCell.drawx + 25;
      const routeCenterY = routeCell.drawy + 25;

      return !activeMines.some(mine => Math.hypot(mine.targetX - routeCenterX, mine.targetY - routeCenterY) < 35);
    });

    const targetCells = freePathCells.length > 0 ? freePathCells : inRangePathCells;
    const randomPathCell = targetCells[Math.floor(Math.random() * targetCells.length)];
    const grenadeX = randomPathCell.drawx + 25;
    const grenadeY = randomPathCell.drawy + 25;

    const grenade = this.grenadeService.create(
      towerCenterX,
      towerCenterY,
      grenadeX,
      grenadeY,
      weapon.damage,
      getDamageTypeForWeaponType(weapon.type)
    );
    if (grenade.type !== projectileType) {
      throw new Error(`Projectile config mismatch for ${weapon.type}`);
    }
    this.projectileService.addProjectile(grenade);
  }
}
