import { Injectable, NgZone, inject } from '@angular/core';

import { EnemyService } from '../enemies/enemy.service';
import { ExplosionService } from '../explosions/explosion.service';
import { ProjectileService } from '../projectiles/projectile.service';
import { TowerService } from '../towers/tower.service';

import { CanvasService } from './canvas.service';
import { GridService } from './grid.service';
import { WaveService } from './wave.service';

@Injectable({
  providedIn: 'root',
})
export class GameLoopService {
  public paused: boolean;
  public speed: number;

  private deltaCalc: number | undefined;
  private then: number;
  private dt: number;
  private accumulator: number;
  private fps: number;
  private lastRefresh: number;

  private readonly projectileService = inject(ProjectileService);
  private readonly towerService = inject(TowerService);
  private readonly gridService = inject(GridService);
  private readonly canvasService = inject(CanvasService);
  private readonly enemyService = inject(EnemyService);
  private readonly explosionService = inject(ExplosionService);
  private readonly waveService = inject(WaveService);
  private readonly ngZone = inject(NgZone);

  constructor() {
    this.then = new Date().getTime();
    this.speed = 1;
    this.dt = 1000 / (60 * this.speed) / 1000;
    this.accumulator = 0.0;
    this.paused = false;

    this.fps = 1000 / 120 / 1000;
    this.lastRefresh = 0;
  }

  public draw() {
    if (!this.paused) {
      const now = new Date().getTime();
      this.deltaCalc = (now - this.then) / 1000;

      this.lastRefresh += this.deltaCalc;

      //If code is paused minimum is 2FPS.
      if (this.deltaCalc > 0.5) {
        this.deltaCalc = 0.5;
      }

      this.then = now;

      this.accumulator += this.deltaCalc;

      while (this.accumulator >= this.dt) {
        this.accumulator -= this.dt;

        //this.gridService.calculateTurrets();
        //this.gridService.calculateEnemies();
        // Scale wave timers with simulation speed to keep spawning/intermission pacing aligned.
        this.waveService.tick(this.dt * 1000 * this.speed);
        this.enemyService.calculate();
        //this.gridService.calculateBullets();
        this.towerService.calculate();
        this.projectileService.calculate();
        this.explosionService.calculate();
        //this.gridService.calculateExplosions();
      }
    }

    if (this.lastRefresh > this.fps) {
      this.lastRefresh = 0;
      this.canvasService.clear();

      this.gridService.draw();
      this.gridService.drawAssets();
      //this.gridService.drawTurrets();
      //this.gridService.drawEnemies();
      //this.gridService.drawExplosions();
      //this.gridService.drawBullets();
      this.enemyService.draw();
      this.towerService.draw();
      this.projectileService.draw();
      this.explosionService.draw();
    }

    requestAnimationFrame(this.draw.bind(this));
  }

  public start(): void {
    this.ngZone.runOutsideAngular(() => this.draw());
  }

  public changeSpeed(): void {
    this.speed = this.speed !== 4 ? this.speed + 1 : 1;
    this.dt = 1000 / (60 * this.speed) / 1000;
  }

  public changePause(): void {
    this.paused = this.paused ? false : true;
  }

  public setSpeed(speed: number): void {
    const clampedSpeed = Math.max(1, Math.min(4, Math.floor(speed)));
    this.speed = clampedSpeed;
    this.dt = 1000 / (60 * this.speed) / 1000;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }
}
