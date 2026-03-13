import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { BulletShooter, WeaponType } from '../../models/weapons/weapon.model';
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
export class BasicTurretService extends WeaponService {
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

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): BulletShooter {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);

    const weapon: BulletShooter = {
      ...baseWeapon,
      type: WeaponType.BulletShooter, // Explicitly set the specific type
      angle: Math.floor(Math.random() * 360),
    };

    this.setStats(weapon);

    return weapon;
  }

  public shoot(weapon: BulletShooter): void {
    const bullet = this.turretBulletService.create(
      this.requireBulletProjectileType(weapon.type),
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      weapon.damage,
      this.requireProjectileSpeed(weapon.type),
      getDamageTypeForWeaponType(weapon.type)
    );
    this.projectileService.addProjectile(bullet);
  }
}
