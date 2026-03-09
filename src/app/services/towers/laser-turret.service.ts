import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { delta } from '../../models/constants';
import { LaserTurret, Weapon, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { LaserService } from '../projectiles/laser.service';
import { ProjectileService } from '../projectiles/projectile.service';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class LaserTurretService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly laserService = inject(LaserService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): LaserTurret {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);

    const weapon: LaserTurret = {
      ...baseWeapon,
      duration: 1000,
      type: WeaponType.LaserTurret,
      angle: Math.floor(Math.random() * 360),
    };

    this.setStats(weapon);

    return weapon;
  }

  public override calculate(weapon: Weapon): void {
    if (weapon.lastFired > weapon.speed) {
      super.calculate(weapon);
    } else {
      weapon.lastFired += delta * 1000;
      weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
      weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;
    }
  }

  public shoot(weapon: LaserTurret): void {
    const laser = this.laserService.create(
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      weapon.damage,
      getDamageTypeForWeaponType(weapon.type)
    );
    this.projectileService.addProjectile(laser);
  }
}
