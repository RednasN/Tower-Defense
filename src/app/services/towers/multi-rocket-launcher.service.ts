import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { delta } from '../../models/constants';
import { MultiRocketLauncher, WeaponType } from '../../models/weapons/weapon.model';
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
export class MultiRocketLauncherService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly rocketService = inject(RocketService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): MultiRocketLauncher {
    const launcher: MultiRocketLauncher = {
      ...super.create(x, y, speedLevel, powerLevel, rangeLevel),
      type: WeaponType.MultiRocketLauncher,
      range: 1000,
      damage: 1,
      speed: 2000,
      angle: Math.floor(Math.random() * 360),
      canons: [45, 135, 225, 315],
    };

    this.setStats(launcher);
    return launcher;
  }

  public override calculate(weapon: MultiRocketLauncher): void {
    weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;

    weapon.angle += 35 * delta;
    if (weapon.angle > 359) {
      weapon.angle = 0;
    }

    for (let i = 0; i < weapon.canons.length; i++) {
      weapon.canons[i] = (weapon.canons[i] + 1) % 360;
    }

    this.findClosest(weapon);

    if (weapon.focusedIndex !== -1 && !this.isInRange(weapon, weapon.focusedIndex)) {
      weapon.focusedIndex = -1;
    }

    this.canShoot(weapon);
  }

  public shoot(weapon: MultiRocketLauncher): void {
    const angle = weapon.canons[Math.floor(Math.random() * weapon.canons.length)];
    const splitRocket = this.turretConfigService.getTurretConfig(weapon.type).splitRocket;
    if (!splitRocket) {
      throw new Error('Missing split rocket config.');
    }

    const rocket = this.rocketService.create(
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      angle,
      weapon.damage,
      this.requireProjectileSpeed(weapon.type),
      getDamageTypeForWeaponType(weapon.type),
      {
        isChild: false,
        splitDelayRemainingMs: splitRocket.splitDelayMs,
        childRocketCount: splitRocket.childRocketCount,
        childSearchRadius: splitRocket.childSearchRadius,
        childDamageMultiplier: splitRocket.childDamageMultiplier,
        childSpeedMultiplier: splitRocket.childSpeedMultiplier,
      }
    );
    this.projectileService.addProjectile(rocket);
  }
}
