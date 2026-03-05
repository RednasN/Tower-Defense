import { Injectable, inject } from '@angular/core';

import { delta } from '../../models/constants';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';

@Injectable({
  providedIn: 'root',
})
export class EnemyTankService {
  private readonly gridService = inject(GridService);
  private readonly canvasService = inject(CanvasService);
  public create(reward: number, lives: number, imageIndex: number, speed = 100): EnemyTank {
    const enemyTank = {
      reward,
      lives,
      maxLives: lives,
      imageIndex,
      drawx: -1,
      drawy: -1,
      routeindex: -1,
      curveStartx: null,
      curveStarty: null,
      curveEndx: null,
      curveEndy: null,
      bezierx: null,
      beziery: null,
      t: 0.0,
      angle: 0,
      died: false,
      escaped: false,
      isRight: true,
      speed,
      docurve: false,
    };

    enemyTank.routeindex = this.gridService.route.length - 1;
    enemyTank.drawx = this.gridService.route[enemyTank.routeindex].drawx;
    enemyTank.drawy = this.gridService.route[enemyTank.routeindex].drawy;

    return enemyTank;
  }

  public hit(enemyTank: EnemyTank, hit: number): void {
    if (enemyTank.lives <= 0) {
      return;
    }

    enemyTank.lives = Math.max(0, enemyTank.lives - hit);
  }

  public calculate(enemyTank: EnemyTank): void {
    if (enemyTank.lives <= 0) {
      return;
    }

    const oldDrawx = enemyTank.drawx;
    const oldDrawy = enemyTank.drawy;

    if (
      this.isCloseEnough(
        { x: enemyTank.drawx, y: enemyTank.drawy },
        { x: this.gridService.route[enemyTank.routeindex].drawx, y: this.gridService.route[enemyTank.routeindex].drawy },
        3
      )
    ) {
      if (enemyTank.routeindex === 0) {
        enemyTank.escaped = true;
        enemyTank.lives = 0;
        enemyTank.died = true;
        return;
      }

      if (enemyTank.routeindex !== 0) {
        enemyTank.routeindex -= 1;
      }

      if (enemyTank.routeindex - 1 >= 0) {
        const prev = this.gridService.route[enemyTank.routeindex - 1];
        const next = this.gridService.route[enemyTank.routeindex + 1];
        const current = this.gridService.route[enemyTank.routeindex];

        if (this.shouldCurve(next, prev)) {
          enemyTank.docurve = true;
          enemyTank.curveStartx = next.drawx;
          enemyTank.curveStarty = next.drawy;
          enemyTank.curveEndx = prev.drawx;
          enemyTank.curveEndy = prev.drawy;
          enemyTank.bezierx = current.drawx;
          enemyTank.beziery = current.drawy;

          enemyTank.isRight = this.determineDirection({ x: next.x, y: next.y }, { x: current.x, y: current.y }, { x: prev.x, y: prev.y });
        }
      }
    }

    if (enemyTank.docurve) {
      // Calculate Bézier curve position
      enemyTank.drawx = this.calculateBezier(enemyTank.t, enemyTank.curveStartx!, enemyTank.bezierx!, enemyTank.curveEndx!);
      enemyTank.drawy = this.calculateBezier(enemyTank.t, enemyTank.curveStarty!, enemyTank.beziery!, enemyTank.curveEndy!);

      // Increment t for curve animation
      enemyTank.t += (enemyTank.speed / 100) * delta;
      if (enemyTank.t > 1) {
        enemyTank.routeindex--;
        enemyTank.docurve = false;
        enemyTank.t = 0;
      }

      // Determine angle based on direction
      const deltaX = enemyTank.isRight ? enemyTank.drawx - enemyTank.bezierx! : enemyTank.bezierx! - enemyTank.drawx;
      const deltaY = enemyTank.isRight ? enemyTank.drawy - enemyTank.beziery! : enemyTank.beziery! - enemyTank.drawy;

      enemyTank.angle = this.calculateAngle(deltaX, deltaY);
    } else {
      const target = this.gridService.route[enemyTank.routeindex];

      // Update position based on target
      if (enemyTank.drawx + this.canvasService.mainCanvasXOffset !== target.drawx + this.canvasService.mainCanvasXOffset) {
        enemyTank.drawx +=
          (target.drawx + this.canvasService.mainCanvasXOffset > enemyTank.drawx + this.canvasService.mainCanvasXOffset ? 1 : -1) *
          enemyTank.speed *
          delta;
      }

      if (enemyTank.drawy + this.canvasService.mainCanvasYOffset !== target.drawy + this.canvasService.mainCanvasYOffset) {
        enemyTank.drawy +=
          (target.drawy + this.canvasService.mainCanvasYOffset > enemyTank.drawy + this.canvasService.mainCanvasYOffset ? 1 : -1) *
          enemyTank.speed *
          delta;
      }

      // Calculate angle
      const deltaX = oldDrawx - enemyTank.drawx;
      const deltaY = oldDrawy - enemyTank.drawy;

      const rad = Math.atan2(deltaY, deltaX); // In radians
      enemyTank.angle = (Math.round((rad * 180) / Math.PI) + 180) % 360;
    }
  }

  // Helper function to calculate quadratic Bézier curve position
  private calculateBezier(t: number, start: number, control: number, end: number): number {
    return Math.round((1 - t) * (1 - t) * start + 2 * (1 - t) * t * control + t * t * end);
  }

  // Helper function to calculate angle based on deltaX and deltaY
  private calculateAngle(deltaX: number, deltaY: number): number {
    const angle = Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 180);
    return angle > 359 ? 0 : angle < 0 ? 359 : 360 - angle;
  }

  private isCloseEnough(point1: { x: number; y: number }, point2: { x: number; y: number }, threshold: number): boolean {
    return Math.abs(point1.x - point2.x) < threshold && Math.abs(point1.y - point2.y) < threshold;
  }

  private shouldCurve(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
    return start.y !== end.y && start.x !== end.x;
  }

  private determineDirection(start: { x: number; y: number }, mid: { x: number; y: number }, end: { x: number; y: number }): boolean {
    return !(
      start.x === mid.x &&
      ((start.x > end.x && start.y > end.y && start.y > mid.y) ||
        (start.x < end.x && start.y < end.y && start.y < mid.y) ||
        (start.x < end.x && start.y > end.y && start.y > mid.y) ||
        (start.x > end.x && start.y < end.y && start.y < mid.y))
    );
  }
}
