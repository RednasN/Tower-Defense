import { Injectable, inject } from '@angular/core';

import { DamageType } from '../../models/configs/turret-config.model';
import { FlameBubbleConfig } from '../../models/configs/balance-types';
import { delta } from '../../models/constants';
import { FlameBubble } from '../../models/projectiles/projectile.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { EnemyService } from '../enemies/enemy.service';

@Injectable({
  providedIn: 'root',
})
export class FlameBubbleService {
  private readonly enemyService = inject(EnemyService);

  public create(
    gridX: number,
    gridY: number,
    x: number,
    y: number,
    angle: number,
    damage: number,
    speed: number,
    damageType: DamageType,
    flameBubble: FlameBubbleConfig
  ): FlameBubble {
    return {
      type: ProjectileType.FlameBubble,
      gridX,
      gridY,
      x,
      y,
      needdraw: true,
      damage,
      damageType,
      angle,
      speed,
      remainingMs: flameBubble.lifetimeMs,
      hitRadius: flameBubble.hitRadius,
      scale: flameBubble.visualScale,
      hitEnemyIndexes: [],
    };
  }

  public calculate(projectile: FlameBubble): void {
    const radians = (projectile.angle * Math.PI) / 180;
    projectile.x += Math.cos(radians) * projectile.speed * delta;
    projectile.y += Math.sin(radians) * projectile.speed * delta;
    projectile.remainingMs -= delta * 1000;

    for (let enemyIndex = 0; enemyIndex < this.enemyService.enemies.length; enemyIndex++) {
      if (projectile.hitEnemyIndexes.includes(enemyIndex)) {
        continue;
      }

      const enemy = this.enemyService.enemies[enemyIndex];
      if (!enemy || enemy.lives <= 0) {
        continue;
      }

      const distance = Math.hypot(enemy.drawx + 25 - projectile.x, enemy.drawy + 25 - projectile.y);
      if (distance <= projectile.hitRadius + 18) {
        projectile.hitEnemyIndexes.push(enemyIndex);
        this.enemyService.hit(enemyIndex, projectile.damage, projectile.damageType);
      }
    }

    if (projectile.remainingMs <= 0) {
      projectile.needdraw = false;
    }
  }
}
