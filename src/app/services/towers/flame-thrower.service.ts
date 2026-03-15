import { Injectable, inject } from '@angular/core';

import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { FlameThrower, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { FlameBubbleService } from '../projectiles/flame-bubble.service';
import { ProjectileService } from '../projectiles/projectile.service';
import { getFlameBubbleAngles } from '../../simulation/flame-bubble';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class FlameThrowerService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly flameBubbleService = inject(FlameBubbleService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): FlameThrower {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);

    const weapon: FlameThrower = {
      ...baseWeapon,
      type: WeaponType.FlameThrower,
      angle: Math.floor(Math.random() * 360),
    };

    this.setStats(weapon);
    return weapon;
  }

  public shoot(weapon: FlameThrower): void {
    const { projectileSpeed } = this.getProjectileMetadata(weapon.type);
    if (projectileSpeed === null) {
      throw new Error(`Flame thrower ${weapon.type} requires a projectile speed.`);
    }

    const flameBubble = this.turretConfigService.getTurretConfig(weapon.type).flameBubble;
    if (!flameBubble) {
      throw new Error('Missing flame bubble config.');
    }

    const centerX = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + 25;
    const centerY = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + 25;
    const angles = getFlameBubbleAngles(weapon.angle, flameBubble.bubblesPerShot, flameBubble.spreadDegrees);

    for (const angle of angles) {
      const radians = (angle * Math.PI) / 180;
      const offsetX = centerX + Math.cos(radians) * 18;
      const offsetY = centerY + Math.sin(radians) * 18;
      const projectile = this.flameBubbleService.create(
        weapon.gridX,
        weapon.gridY,
        offsetX,
        offsetY,
        angle,
        weapon.damage,
        projectileSpeed,
        getDamageTypeForWeaponType(weapon.type),
        flameBubble
      );
      this.projectileService.addProjectile(projectile);
    }
  }
}
