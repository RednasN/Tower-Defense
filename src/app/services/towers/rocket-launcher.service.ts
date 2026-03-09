import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { delta } from '../../models/constants';
import { RocketLauncher, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ProjectileService } from '../projectiles/projectile.service';
import { RocketService } from '../projectiles/rocket.service';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class RocketLauncherService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly rocketService = inject(RocketService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService); // Pass dependencies to the abstract class
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): RocketLauncher {
    const launcher: RocketLauncher = {
      ...super.create(x, y, speedLevel, powerLevel, rangeLevel),
      type: WeaponType.RocketLauncher,
      range: 1000,
      damage: 1,
      speed: 2000,
      angle: Math.floor(Math.random() * (359 - 0 + 1) + 0),
      canons: [0, 90, 180, 270],
    };

    this.setStats(launcher);
    return launcher;
  }

  public override calculate(weapon: RocketLauncher): void {
    weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;

    weapon.angle += 35 * delta;
    if (weapon.angle > 359) {
      weapon.angle = 0;
    }

    for (let i = 0; i < weapon.canons.length; i++) {
      weapon.canons[i]++;
      if (weapon.canons[i] === 359) {
        weapon.canons[i] = 0;
      }
    }

    this.findClosest(weapon);

    if (weapon.focusedIndex !== -1 && !this.isInRange(weapon, weapon.focusedIndex)) {
      weapon.focusedIndex = -1;
    }

    this.canShoot(weapon);
  }

  public shoot(weapon: RocketLauncher): void {
    const angle = weapon.canons[Math.floor(Math.random() * weapon.canons.length)];
    const rocket = this.rocketService.create(
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      angle,
      weapon.damage,
      getDamageTypeForWeaponType(weapon.type)
    );
    this.projectileService.addProjectile(rocket);
  }
}
