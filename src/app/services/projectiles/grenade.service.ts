import { Injectable, inject } from '@angular/core';

import { delta } from '../../models/constants';
import { ProjectileType, type Grenade } from '../../models/projectiles/projectile.model';
import { EnemyService } from '../enemies/enemy.service';
import { ExplosionService } from '../explosions/explosion.service';

@Injectable({
  providedIn: 'root',
})
export class GrenadeService {
  private readonly enemyService = inject(EnemyService);
  private readonly explosionService = inject(ExplosionService);

  public create(startX: number, startY: number, targetX: number, targetY: number, damage: number): Grenade {
    const rad = Math.atan2(targetY - startY, targetX - startX);
    const angle = (Math.round((rad * 180) / Math.PI) + 360) % 360;

    return {
      type: ProjectileType.GrenadeMine,
      gridX: -1,
      gridY: -1,
      x: startX,
      y: startY,
      enemyIndex: -1,
      needdraw: true,
      damage,
      angle,
      speed: 250,
      targetX,
      targetY,
      isArmed: false,
      blinkTimerMs: 150,
      blastRadius: 45,
      triggerRadius: 22,
      lifeTimeMs: 8000,
    };
  }

  public calculate(grenade: Grenade): void {
    if (!grenade.isArmed) {
      const remainingX = grenade.targetX - grenade.x;
      const remainingY = grenade.targetY - grenade.y;
      const distance = Math.hypot(remainingX, remainingY);
      const step = grenade.speed * delta;

      if (distance <= step) {
        grenade.x = grenade.targetX;
        grenade.y = grenade.targetY;
        grenade.isArmed = true;
        grenade.angle = 0;
      } else {
        grenade.x += (remainingX / distance) * step;
        grenade.y += (remainingY / distance) * step;
      }

      return;
    }

    grenade.blinkTimerMs -= delta * 1000;
    if (grenade.blinkTimerMs <= 0) {
      grenade.angle = grenade.angle === 0 ? 1 : 0;
      grenade.blinkTimerMs = 150;
    }

    grenade.lifeTimeMs -= delta * 1000;

    if (grenade.lifeTimeMs <= 0) {
      grenade.needdraw = false;
      return;
    }

    let shouldExplode = false;

    for (const enemy of this.enemyService.enemies) {

      if (enemy.lives <= 0) {
        continue;
      }

      const enemyCenterX = enemy.drawx + 25;
      const enemyCenterY = enemy.drawy + 25;
      const distanceToGrenade = Math.hypot(enemyCenterX - grenade.x, enemyCenterY - grenade.y);

      if (distanceToGrenade <= grenade.triggerRadius) {
        shouldExplode = true;
        break;
      }
    }

    if (!shouldExplode) {
      return;
    }

    this.explosionService.createDefaultExplosion(grenade.x - 25, grenade.y - 25, 0);

    for (const [enemyIndex, enemy] of this.enemyService.enemies.entries()) {

      if (enemy.lives <= 0) {
        continue;
      }

      const enemyCenterX = enemy.drawx + 25;
      const enemyCenterY = enemy.drawy + 25;
      const distanceToBlast = Math.hypot(enemyCenterX - grenade.x, enemyCenterY - grenade.y);

      if (distanceToBlast <= grenade.blastRadius) {
        this.enemyService.hit(enemyIndex, grenade.damage);
      }
    }

    grenade.needdraw = false;
  }
}
