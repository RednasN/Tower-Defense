import { Injectable, inject } from '@angular/core';

import { Explosion, isDefaultExplosion } from '../../models/side-effects/explosion.model';
import { CanvasService } from '../game/canvas.service';
import { ImageService } from '../game/image.service';

import { DefaultExplosionService } from './default-explosion.service';

@Injectable({
  providedIn: 'root',
})
export class ExplosionService {
  private readonly defaultExplosionService = inject(DefaultExplosionService);
  private readonly canvasService = inject(CanvasService);
  private readonly imageService = inject(ImageService);

  public explosions: Explosion[] = [];

  public createDefaultExplosion(x: number, y: number, imageIndex: number): void {
    const explosion = this.defaultExplosionService.create(x, y, imageIndex);
    this.explosions.push(explosion);
  }

  public calculate(): void {
    this.explosions.forEach(explosion => {
      if (isDefaultExplosion(explosion)) {
        this.defaultExplosionService.calculate(explosion);
      }
    });
  }

  public draw(): void {
    this.explosions.forEach(explosion => {
      if (this.imageService.explosions[explosion.explosionListIndex].images[explosion.explosionIndex] !== undefined) {
        this.canvasService.draw(
          this.imageService.explosions[explosion.explosionListIndex].images[explosion.explosionIndex],
          Math.round(explosion.drawx) + this.canvasService.mainCanvasXOffset,
          Math.round(explosion.drawy) + this.canvasService.mainCanvasYOffset
        );
      }
    });
  }
}
