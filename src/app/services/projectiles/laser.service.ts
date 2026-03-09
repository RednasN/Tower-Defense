import { Injectable, inject } from '@angular/core';

import { DamageType } from '../../models/configs/turret-config.model';
import { Laser, ProjectileType } from '../../models/projectiles/projectile.model';
import { EnemyService } from '../enemies/enemy.service';
import { GridService } from '../game/grid.service';

@Injectable({
  providedIn: 'root',
})
export class LaserService {
  private readonly gridService = inject(GridService);
  private readonly enemyService = inject(EnemyService);

  public create(x: number, y: number, enemyIndex: number, damage: number, damageType: DamageType): Laser {
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
      duration: 10,
      type: ProjectileType.Laser,
      gridX: x,
      gridY: y,
      x: centerTurretX - 25 * Math.cos(rad),
      y: centerTurretY - 25 * Math.sin(rad),
      enemyIndex,
      needdraw: true,
      damage,
      damageType,
      angle: null,
      laserParts: [],
    };
  }

  public calculate(bullet: Laser): void {
    bullet.duration--;
    const cell = this.gridService.grid[bullet.gridX][bullet.gridY];
    const enemy = this.enemyService.enemies[bullet.enemyIndex];

    if (bullet.duration <= 0) {
      bullet.needdraw = false;
    }

    this.enemyService.hit(bullet.enemyIndex, bullet.damage, bullet.damageType);

    const cellHeight = cell.height / 2;
    const cellWidth = cell.width / 2;

    const centerTurretX = cell.drawx + cellWidth;
    const centerTurretY = cell.drawy + cellHeight;

    const centerEnemyX = enemy.drawx + cellWidth;
    const centerEnemyY = enemy.drawy + cellHeight;

    const deltaX = centerEnemyX - centerTurretX;
    const deltaY = centerEnemyY - centerTurretY;

    const rad = Math.atan2(deltaY, deltaX);

    bullet.angle = Math.round((rad * 180) / Math.PI + 180);

    if (bullet.angle === 360) {
      bullet.angle = 359;
    }

    // Calculate the total length and shorten it by 10px
    let length = Math.sqrt(deltaX * deltaX + deltaY * deltaY) - 15;

    // Prevent negative lengths (e.g., if distance is less than 10px)
    if (length < 0) length = 0;

    const stepSize = 20; // Step size for smoother transitions
    const steps = Math.floor(length / stepSize); // Total number of steps
    const remainingLength = length - steps * stepSize; // Remaining length for the final segment

    bullet.laserParts = [];

    for (let i = 0; i < steps; i++) {
      const t = i / steps; // Interpolation factor (from 0 to 1)

      // Linearly interpolate between the turret and shortened target position
      const x = centerTurretX + deltaX * (t * (length / (length + 10))) - 16;
      const y = centerTurretY + deltaY * (t * (length / (length + 10))) - 16;

      bullet.laserParts.push({ x, y });
    }

    // Handle remaining length (final segment)
    if (remainingLength > 0) {
      const t = length / (length + 15); // Adjust factor for shortened length
      const x = centerTurretX + deltaX * t - 16;
      const y = centerTurretY + deltaY * t - 16;

      bullet.laserParts.push({ x, y }); // Add the final segment
    }
  }
}
