import { Injectable, inject } from '@angular/core';

import { delta } from '../../models/constants';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { getDamageTypeForWeaponType } from '../../models/configs/turret-config.model';
import { ChainLightningTower, Weapon, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ChainLightningService } from '../projectiles/chain-lightning.service';
import { ProjectileService } from '../projectiles/projectile.service';

import { TurretConfigService } from './turret-config.service';
import { WeaponService } from './weapon.service';

@Injectable({
  providedIn: 'root',
})
export class ChainLightningTowerService extends WeaponService {
  private readonly projectileService = inject(ProjectileService);
  private readonly chainLightningService = inject(ChainLightningService);

  constructor(
    gridService: GridService,
    canvasService: CanvasService,
    enemyService: EnemyService,
    turretConfigService: TurretConfigService
  ) {
    super(gridService, canvasService, enemyService, turretConfigService);
  }

  public override create(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): ChainLightningTower {
    const baseWeapon = super.create(x, y, speedLevel, powerLevel, rangeLevel);
    const weapon: ChainLightningTower = {
      ...baseWeapon,
      type: WeaponType.ChainLightningTower,
      angle: 0,
    };

    this.setStats(weapon);
    return weapon;
  }

  public override calculate(weapon: Weapon): void {
    weapon.startx = this.gridService.grid[weapon.gridX][weapon.gridY].drawx + this.canvasService.mainCanvasXOffset;
    weapon.starty = this.gridService.grid[weapon.gridX][weapon.gridY].drawy + this.canvasService.mainCanvasYOffset;
    weapon.angle = 0;
    this.findClosest(weapon);

    if (weapon.focusedIndex !== -1 && !this.isInRange(weapon, weapon.focusedIndex)) {
      weapon.focusedIndex = -1;
    }

    if (weapon.focusedIndex === -1) {
      return;
    }

    weapon.locked = true;
    weapon.lastFired += delta * 1000;
    if (weapon.lastFired > weapon.speed) {
      this.shoot(weapon as ChainLightningTower);
      weapon.lastFired = 0;
    }
  }

  public shoot(weapon: ChainLightningTower): void {
    const { projectileType, projectileSpeed } = this.getProjectileMetadata(weapon.type);
    if (projectileType !== ProjectileType.ChainLightning) {
      throw new Error(`Projectile config mismatch for ${weapon.type}`);
    }
    if (projectileSpeed !== null) {
      throw new Error(`Chain lightning tower ${weapon.type} should not define a projectile speed.`);
    }

    const chainLightningConfig = this.turretConfigService.getTurretConfig(weapon.type).chainLightning;
    if (!chainLightningConfig) {
      throw new Error('Missing chain lightning config.');
    }

    const chainLightning = this.chainLightningService.create(
      weapon.gridX,
      weapon.gridY,
      weapon.focusedIndex,
      weapon.damage,
      getDamageTypeForWeaponType(weapon.type),
      chainLightningConfig
    );
    this.projectileService.addProjectile(chainLightning);
  }
}
