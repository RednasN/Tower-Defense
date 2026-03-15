import { Injectable, inject } from '@angular/core';

import { Projectile } from '../../models/projectiles/projectile.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ImageService } from '../game/image.service';

import { ChainLightningService } from './chain-lightning.service';
import { FlameBubbleService } from './flame-bubble.service';
import { GrenadeService } from './grenade.service';
import { LaserService } from './laser.service';
import { RocketService } from './rocket.service';
import { TurretBulletService } from './turret-bullet.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectileService {
  private readonly canvasService = inject(CanvasService);
  private readonly gridService = inject(GridService);
  private readonly imageService = inject(ImageService);

  private readonly rocketService = inject(RocketService);
  private readonly laserService = inject(LaserService);
  private readonly chainLightningService = inject(ChainLightningService);
  private readonly flameBubbleService = inject(FlameBubbleService);
  private readonly turretBulletService = inject(TurretBulletService);
  private readonly grenadeService = inject(GrenadeService);

  public projectiles: Projectile[] = [];

  public addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  public calculate(): void {
    const spawnedProjectiles: Projectile[] = [];
    this.projectiles.forEach(projectile => {
      if (projectile.type === ProjectileType.Rocket) {
        spawnedProjectiles.push(...this.rocketService.calculate(projectile));
      }

      if (
        projectile.type === ProjectileType.Bullet ||
        projectile.type === ProjectileType.FlameBubble ||
        projectile.type === ProjectileType.SlowRocket ||
        projectile.type === ProjectileType.NuclearBullet
      ) {
        if (projectile.type === ProjectileType.FlameBubble) {
          this.flameBubbleService.calculate(projectile);
        } else {
          this.turretBulletService.calculate(projectile);
        }
      }

      if (projectile.type === ProjectileType.Laser) {
        this.laserService.calculate(projectile);
      }

      if (projectile.type === ProjectileType.ChainLightning) {
        this.chainLightningService.calculate(projectile);
      }

      if (projectile.type === ProjectileType.GrenadeMine) {
        this.grenadeService.calculate(projectile);
      }
    });

    if (spawnedProjectiles.length > 0) {
      this.projectiles.push(...spawnedProjectiles);
    }
    this.projectiles = this.projectiles.filter(projectile => projectile.needdraw);
  }

  public draw(): void {
    this.projectiles.forEach(projectile => {
      if (projectile.needdraw) {
        try {
          switch (projectile.type) {
            case ProjectileType.Laser: {
              const fromX = projectile.x + this.canvasService.mainCanvasXOffset;
              const fromY = projectile.y + this.canvasService.mainCanvasYOffset;
              const toX = projectile.targetX + this.canvasService.mainCanvasXOffset;
              const toY = projectile.targetY + this.canvasService.mainCanvasYOffset;
              this.canvasService.strokeLine(fromX, fromY, toX, toY, 'rgba(38, 154, 196, 0.45)', 8);
              this.canvasService.strokeLine(fromX, fromY, toX, toY, 'rgba(98, 236, 255, 0.72)', 4);
              this.canvasService.strokeLine(fromX, fromY, toX, toY, 'rgba(238, 251, 255, 0.95)', 2);
              break;
            }

            case ProjectileType.ChainLightning: {
              for (let segmentIndex = 0; segmentIndex < projectile.segments.length; segmentIndex++) {
                const segment = projectile.segments[segmentIndex];
                const points = this.createLightningPolyline(
                  segment.fromX + this.canvasService.mainCanvasXOffset,
                  segment.fromY + this.canvasService.mainCanvasYOffset,
                  segment.toX + this.canvasService.mainCanvasXOffset,
                  segment.toY + this.canvasService.mainCanvasYOffset,
                  projectile.duration,
                  segmentIndex
                );

                this.canvasService.strokePolyline(points, 'rgba(85, 215, 255, 0.28)', 9);
                this.canvasService.strokePolyline(points, 'rgba(120, 231, 255, 0.55)', 5);
                this.canvasService.strokePolyline(points, 'rgba(245, 250, 255, 0.95)', 2.2);
              }
              break;
            }

            case ProjectileType.FlameBubble: {
              const flameLife = Math.max(0, Math.min(1, projectile.remainingMs / 320));
              this.canvasService.fillCircle(
                projectile.x + this.canvasService.mainCanvasXOffset,
                projectile.y + this.canvasService.mainCanvasYOffset,
                12 * projectile.scale,
                `rgba(255, 102, 32, ${0.28 + flameLife * 0.18})`
              );
              this.canvasService.fillCircle(
                projectile.x + this.canvasService.mainCanvasXOffset,
                projectile.y + this.canvasService.mainCanvasYOffset,
                8 * projectile.scale,
                `rgba(255, 173, 48, ${0.45 + flameLife * 0.2})`
              );
              this.canvasService.fillCircle(
                projectile.x + this.canvasService.mainCanvasXOffset,
                projectile.y + this.canvasService.mainCanvasYOffset,
                4 * projectile.scale,
                `rgba(255, 242, 186, ${0.65 + flameLife * 0.2})`
              );
              break;
            }

            case ProjectileType.GrenadeMine: {
              const grenadeFrameIndex = projectile.isArmed && projectile.angle === 1 ? 1 : 0;
              const image = this.imageService.bullets[projectile.type][grenadeFrameIndex] ?? this.imageService.bullets[projectile.type][0];
              if (!image) {
                break;
              }

              this.canvasService.draw(
                image,
                projectile.x + this.canvasService.mainCanvasXOffset - 25,
                projectile.y + this.canvasService.mainCanvasYOffset - 25
              );
              break;
            }

            default: {
              const image = this.imageService.getRotationFrame(this.imageService.bullets[projectile.type], projectile.angle ?? 0);
              if (!image) {
                break;
              }

              if (projectile.type === ProjectileType.Rocket && projectile.isChild) {
                this.canvasService.fillCircle(
                  projectile.x + this.canvasService.mainCanvasXOffset,
                  projectile.y + this.canvasService.mainCanvasYOffset,
                  8,
                  'rgba(255, 170, 92, 0.32)'
                );
              }

              this.canvasService.draw(
                image,
                projectile.x + this.canvasService.mainCanvasXOffset - 25,
                projectile.y + this.canvasService.mainCanvasYOffset - 25
              );

              break;
            }
          }
        } catch (err) {
          console.log('Error!', err);
        }
      }
    });
  }

  private createLightningPolyline(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number,
    segmentIndex: number
  ): Array<{ x: number; y: number }> {
    const points = [{ x: fromX, y: fromY }];
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const length = Math.hypot(deltaX, deltaY);
    const segments = Math.max(3, Math.min(7, Math.round(length / 26)));
    const perpendicularX = length > 0 ? -deltaY / length : 0;
    const perpendicularY = length > 0 ? deltaX / length : 0;

    for (let step = 1; step < segments; step++) {
      const t = step / segments;
      const baseX = fromX + deltaX * t;
      const baseY = fromY + deltaY * t;
      const flicker = this.getLightningNoise(fromX, fromY, toX, toY, duration, segmentIndex, step);
      const offset = Math.max(4, length * 0.08) * flicker;
      points.push({
        x: baseX + perpendicularX * offset,
        y: baseY + perpendicularY * offset,
      });
    }

    points.push({ x: toX, y: toY });
    return points;
  }

  private getLightningNoise(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number,
    segmentIndex: number,
    step: number
  ): number {
    const seed = fromX * 12.9898 + fromY * 78.233 + toX * 37.719 + toY * 19.913 + duration * 17.137 + segmentIndex * 5.317 + step;
    return Math.sin(seed) * 0.5 + Math.cos(seed * 0.61) * 0.35;
  }
}
