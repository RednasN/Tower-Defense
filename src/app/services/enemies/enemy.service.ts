import { Injectable, inject } from '@angular/core';

import { ArmorClass, DamageType, getDamageMultiplier } from '../../models/configs/turret-config.model';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { ExplosionService } from '../explosions/explosion.service';
import { CanvasService } from '../game/canvas.service';
import { GameStateService } from '../game/game-state.service';
import { ImageService } from '../game/image.service';

import { EnemyTankService } from './enemy-tank.service';

@Injectable({
  providedIn: 'root',
})
export class EnemyService {
  private readonly healthBarWidth = 34;
  private readonly healthBarHeight = 5;
  private readonly healthBarYOffset = 8;

  private readonly canvasService = inject(CanvasService);
  private readonly imageService = inject(ImageService);

  private readonly enemyTankService = inject(EnemyTankService);
  private readonly explosionService = inject(ExplosionService);

  private readonly gameState = inject(GameStateService);

  public enemies: EnemyTank[] = [];
  private readonly damageByType: Record<DamageType, number> = {
    [DamageType.Bullet]: 0,
    [DamageType.Explosive]: 0,
    [DamageType.Energy]: 0,
    [DamageType.SlowExplosive]: 0,
  };

  public createEnemyTank(reward: number, lives: number, imageIndex: number, armorClass: ArmorClass, speed = 100): void {
    const enemyTank = this.enemyTankService.create(reward, lives, imageIndex, armorClass, speed);
    this.enemies.push(enemyTank);
  }

  public calculate(): void {
    this.enemies.forEach(enemy => {
      this.enemyTankService.calculate(enemy);
    });
  }

  public draw(): void {
    this.enemies.forEach(enemy => {
      if (enemy.lives <= 0) {
        this.handleEnemyDestroyed(enemy);
        return;
      }

      this.canvasService.draw(
        this.imageService.getRotationFrame(this.imageService.enemies[enemy.imageIndex].images, enemy.angle),
        Math.round(enemy.drawx) + this.canvasService.mainCanvasXOffset,
        Math.round(enemy.drawy) + this.canvasService.mainCanvasYOffset
      );

      this.drawHealthBar(enemy);
    });
  }

  public hit(enemyIndex: number, hit: number, damageType: DamageType): void {
    const enemy = this.enemies[enemyIndex];
    if (!enemy || enemy.lives <= 0) {
      return;
    }

    const multiplier = getDamageMultiplier(damageType, enemy.armorClass);
    const adjustedHit = hit * multiplier;
    const previousLives = enemy.lives;
    this.enemyTankService.hit(enemy, adjustedHit);
    this.damageByType[damageType] += Math.max(0, previousLives - enemy.lives);

    if (enemy.lives <= 0) {
      this.handleEnemyDestroyed(enemy);
    }
  }

  public getFirstEnemyAlive(): EnemyTank | undefined {
    return this.enemies.find(enemy => enemy.lives > 0);
  }

  public getDamageStats(): Record<DamageType, number> {
    return { ...this.damageByType };
  }

  public resetDamageStats(): void {
    this.damageByType[DamageType.Bullet] = 0;
    this.damageByType[DamageType.Explosive] = 0;
    this.damageByType[DamageType.Energy] = 0;
    this.damageByType[DamageType.SlowExplosive] = 0;
  }

  private handleEnemyDestroyed(enemy: EnemyTank): void {
    if (enemy.escaped || enemy.died) {
      return;
    }

    this.explosionService.createDefaultExplosion(enemy.drawx, enemy.drawy, 0);
    this.gameState.addReward(enemy.reward);
    enemy.died = true;
  }

  private drawHealthBar(enemy: EnemyTank): void {
    const healthRatio = enemy.maxLives > 0 ? Math.max(0, Math.min(1, enemy.lives / enemy.maxLives)) : 0;
    const barX = enemy.drawx + this.canvasService.mainCanvasXOffset + 25 - this.healthBarWidth / 2;
    const barY = enemy.drawy + this.canvasService.mainCanvasYOffset - this.healthBarYOffset;

    this.canvasService.fillRect(barX, barY, this.healthBarWidth, this.healthBarHeight, '#e74c3c');
    this.canvasService.fillRect(barX, barY, this.healthBarWidth * healthRatio, this.healthBarHeight, '#2ecc71');
  }
}
