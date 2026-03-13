import { Injectable, inject } from '@angular/core';

import { Projectile } from '../../models/projectiles/projectile.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ImageService } from '../game/image.service';

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
  private readonly turretBulletService = inject(TurretBulletService);
  private readonly grenadeService = inject(GrenadeService);

  public projectiles: Projectile[] = [];

  public addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  public calculate(): void {
    this.projectiles.forEach(projectile => {
      if (projectile.type === ProjectileType.Rocket) {
        this.rocketService.calculate(projectile);
      }

      if (
        projectile.type === ProjectileType.Bullet ||
        projectile.type === ProjectileType.SlowRocket ||
        projectile.type === ProjectileType.NuclearBullet
      ) {
        this.turretBulletService.calculate(projectile);
      }

      if (projectile.type === ProjectileType.Laser) {
        this.laserService.calculate(projectile);
      }

      if (projectile.type === ProjectileType.GrenadeMine) {
        this.grenadeService.calculate(projectile);
      }
    });

    this.projectiles = this.projectiles.filter(projectile => projectile.needdraw);
  }

  public draw(): void {
    this.projectiles.forEach(projectile => {
      if (projectile.needdraw) {
        try {
          switch (projectile.type) {
            case ProjectileType.Laser: {
              const image = this.imageService.getRotationFrame(this.imageService.bullets[projectile.type], projectile.angle ?? 0);
              for (const laserPart of projectile.laserParts) {
                this.canvasService.draw(
                  image,
                  laserPart.x + this.canvasService.mainCanvasXOffset,
                  laserPart.y + this.canvasService.mainCanvasYOffset
                );
              }
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
}
