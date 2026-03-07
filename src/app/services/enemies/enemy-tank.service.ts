import { Injectable, inject } from '@angular/core';

import { delta } from '../../models/constants';
import { EnemyTank } from '../../models/enemies/enemy-tank.model';
import { GridService } from '../game/grid.service';

@Injectable({
  providedIn: 'root',
})
export class EnemyTankService {
  private readonly turnEpsilon = 0.05;
  private readonly gridService = inject(GridService);

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

    if (this.gridService.route.length === 0) {
      return;
    }

    if (enemyTank.routeindex < 0 || enemyTank.routeindex >= this.gridService.route.length) {
      return;
    }

    const oldDrawx = enemyTank.drawx;
    const oldDrawy = enemyTank.drawy;

    if (enemyTank.docurve) {
      this.calculateCurve(enemyTank);
    } else {
      this.moveTowardsCurrentTarget(enemyTank);
    }

    this.updateAngleFromMovement(enemyTank, oldDrawx, oldDrawy);
  }

  private calculateBezier(t: number, start: number, control: number, end: number): number {
    return (1 - t) * (1 - t) * start + 2 * (1 - t) * t * control + t * t * end;
  }

  private calculateCurve(enemyTank: EnemyTank): void {
    if (
      enemyTank.curveStartx === null ||
      enemyTank.curveStarty === null ||
      enemyTank.curveEndx === null ||
      enemyTank.curveEndy === null ||
      enemyTank.bezierx === null ||
      enemyTank.beziery === null
    ) {
      enemyTank.docurve = false;
      enemyTank.t = 0;
      return;
    }

    enemyTank.t += (enemyTank.speed / 100) * delta;
    const t = Math.min(1, enemyTank.t);

    enemyTank.drawx = this.calculateBezier(t, enemyTank.curveStartx, enemyTank.bezierx, enemyTank.curveEndx);
    enemyTank.drawy = this.calculateBezier(t, enemyTank.curveStarty, enemyTank.beziery, enemyTank.curveEndy);

    if (enemyTank.t >= 1) {
      enemyTank.drawx = enemyTank.curveEndx;
      enemyTank.drawy = enemyTank.curveEndy;
      enemyTank.docurve = false;
      enemyTank.t = 0;

      if (enemyTank.routeindex > 0) {
        enemyTank.routeindex -= 1;
      }

      if (enemyTank.routeindex === 0) {
        enemyTank.escaped = true;
        enemyTank.lives = 0;
        enemyTank.died = true;
      }
    }
  }

  private moveTowardsCurrentTarget(enemyTank: EnemyTank): void {
    let remainingStep = enemyTank.speed * delta;

    while (remainingStep > 0 && !enemyTank.docurve && enemyTank.lives > 0) {
      if (enemyTank.routeindex < 0 || enemyTank.routeindex >= this.gridService.route.length) {
        return;
      }

      const target = this.gridService.route[enemyTank.routeindex];
      const dx = target.drawx - enemyTank.drawx;
      const dy = target.drawy - enemyTank.drawy;
      const distance = Math.hypot(dx, dy);

      if (distance <= remainingStep) {
        enemyTank.drawx = target.drawx;
        enemyTank.drawy = target.drawy;
        remainingStep -= distance;
        this.onReachedRoutePoint(enemyTank);
        continue;
      }

      enemyTank.drawx += (dx / distance) * remainingStep;
      enemyTank.drawy += (dy / distance) * remainingStep;
      remainingStep = 0;
    }
  }

  private onReachedRoutePoint(enemyTank: EnemyTank): void {
    if (enemyTank.routeindex === 0) {
      enemyTank.escaped = true;
      enemyTank.lives = 0;
      enemyTank.died = true;
      return;
    }

    enemyTank.routeindex -= 1;

    if (enemyTank.routeindex - 1 < 0 || enemyTank.routeindex + 1 >= this.gridService.route.length) {
      return;
    }

    const previous = this.gridService.route[enemyTank.routeindex - 1];
    const current = this.gridService.route[enemyTank.routeindex];
    const next = this.gridService.route[enemyTank.routeindex + 1];

    if (!this.shouldCurveOnDirectionChange(next, current, previous)) {
      return;
    }

    enemyTank.docurve = true;
    enemyTank.t = 0;
    enemyTank.curveStartx = next.drawx;
    enemyTank.curveStarty = next.drawy;
    enemyTank.curveEndx = previous.drawx;
    enemyTank.curveEndy = previous.drawy;
    enemyTank.bezierx = current.drawx;
    enemyTank.beziery = current.drawy;
  }

  private updateAngleFromMovement(enemyTank: EnemyTank, oldDrawx: number, oldDrawy: number): void {
    const movementDx = enemyTank.drawx - oldDrawx;
    const movementDy = enemyTank.drawy - oldDrawy;
    const movementMagnitude = Math.hypot(movementDx, movementDy);

    if (movementMagnitude < 0.001) {
      return;
    }

    enemyTank.angle = this.normalizeAngle((Math.atan2(movementDy, movementDx) * 180) / Math.PI);
  }

  private normalizeAngle(angle: number): number {
    const normalizedAngle = Math.round(angle) % 360;
    return normalizedAngle < 0 ? normalizedAngle + 360 : normalizedAngle;
  }

  private shouldCurveOnDirectionChange(
    next: { x: number; y: number },
    current: { x: number; y: number },
    previous: { x: number; y: number }
  ): boolean {
    const v1x = current.x - next.x;
    const v1y = current.y - next.y;
    const v2x = previous.x - current.x;
    const v2y = previous.y - current.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 === 0 || len2 === 0) {
      return false;
    }

    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;

    const cross = n1x * n2y - n1y * n2x;
    return Math.abs(cross) > this.turnEpsilon;
  }
}
