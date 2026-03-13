import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { ProjectileType } from '../../models/projectiles/projectile.model';
import { NuclearLauncher, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ProjectileService } from '../projectiles/projectile.service';
import { TurretBulletService } from '../projectiles/turret-bullet.service';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class NuclearLauncherService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly turretBulletService = inject(TurretBulletService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): NuclearLauncher {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);

    const weapon: NuclearLauncher = {
      ...baseWeapon,
      type: WeaponType.NuclearLauncher, // Explicitly set the specific type
      angle: Math.floor(Math.random() * 360),
    };

    this.setStats(weapon);

    return weapon;
  }

  public shoot(weapon: NuclearLauncher): void {
    const bullet = this.turretBulletService.create(
      ProjectileType.NuclearBullet,
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      weapon.damage,
      500,
      getDamageTypeForWeaponType(weapon.type)
    );
    this.projectileService.addProjectile(bullet);
  }
}
