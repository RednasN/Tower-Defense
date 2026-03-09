import { Injectable, inject } from '@angular/core';

import { DamageType } from '../../models/configs/turret-config.model';
import { delta } from '../../models/constants';
import { Bullet, ProjectileType } from '../../models/projectiles/projectile.model';
import { EnemyService } from '../enemies/enemy.service';
import { GridService } from '../game/grid.service';

@Injectable({
  providedIn: 'root',
})
export class TurretBulletService {
  private readonly gridService = inject(GridService);
  private readonly enemyService = inject(EnemyService);

  public create(
    type: ProjectileType.Bullet | ProjectileType.SlowRocket | ProjectileType.NuclearBullet,
    x: number,
    y: number,
    enemyIndex: number,
    damage: number,
    speed: number,
    damageType: DamageType
  ): Bullet {
    const cellHeight = this.gridService.grid[x][y].height / 2;
    const cellWidth = this.gridService.grid[x][y].width / 2;

    const centerTurretX = this.gridService.grid[x][y].drawx + cellWidth;
    const centerTurretY = this.gridService.grid[x][y].drawy + cellHeight;

    const centerEnemyX = this.enemyService.enemies[enemyIndex].drawx + cellWidth;
    const centerEnemyY = this.enemyService.enemies[enemyIndex].drawy + cellHeight;

    const deltaX = centerTurretX - centerEnemyX;
    const deltaY = centerTurretY - centerEnemyY;

    const rad = Math.atan2(deltaY, deltaX);

    return {
      speed,
      damage,
      damageType,
      type: type,
      gridX: x,
      gridY: y,
      x: centerTurretX - 25 * Math.cos(rad),
      y: centerTurretY - 25 * Math.sin(rad),
      enemyIndex,
      needdraw: true,
      angle: null,
    };
  }

  public calculate(bullet: Bullet): void {
    if (bullet.needdraw) {
      const centerEnemyX = this.enemyService.enemies[bullet.enemyIndex].drawx + 25;
      const centerEnemyY = this.enemyService.enemies[bullet.enemyIndex].drawy + 25;

      const deltaX = bullet.x - centerEnemyX;
      const deltaY = bullet.y - centerEnemyY;

      const rad = Math.atan2(deltaY, deltaX); // In radians
      bullet.angle = Math.round((rad * 180) / Math.PI + 180);

      if (bullet.angle === 360) {
        bullet.angle = 359;
      }

      bullet.x = bullet.x - bullet.speed * delta * Math.cos(rad);
      bullet.y = bullet.y - bullet.speed * delta * Math.sin(rad);

      if (Math.abs(bullet.x - centerEnemyX) < 10 && Math.abs(bullet.y - centerEnemyY) < 10) {
        bullet.needdraw = false;
        this.enemyService.hit(bullet.enemyIndex, bullet.damage, bullet.damageType);
      }
    }
  }
}
