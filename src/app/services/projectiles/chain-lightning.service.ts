import { Injectable, inject } from '@angular/core';

import { DamageType } from '../../models/configs/turret-config.model';
import { ChainLightningConfig } from '../../models/configs/balance-types';
import { ChainLightning } from '../../models/projectiles/projectile.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { resolveChainLightningShot } from '../../simulation/chain-lightning';
import { EnemyService } from '../enemies/enemy.service';
import { GridService } from '../game/grid.service';

@Injectable({
  providedIn: 'root',
})
export class ChainLightningService {
  private readonly gridService = inject(GridService);
  private readonly enemyService = inject(EnemyService);

  public create(
    x: number,
    y: number,
    enemyIndex: number,
    damage: number,
    damageType: DamageType,
    chainLightning: ChainLightningConfig
  ): ChainLightning {
    const centerTurretX = this.gridService.grid[x][y].drawx + this.gridService.grid[x][y].width / 2;
    const centerTurretY = this.gridService.grid[x][y].drawy + this.gridService.grid[x][y].height / 2;
    const hits = resolveChainLightningShot(this.enemyService.enemies, centerTurretX, centerTurretY, enemyIndex, chainLightning);

    return {
      type: ProjectileType.ChainLightning,
      gridX: x,
      gridY: y,
      x: centerTurretX,
      y: centerTurretY,
      enemyIndex,
      needdraw: hits.length > 0,
      damage,
      damageType,
      duration: chainLightning.durationTicks,
      applied: false,
      segments: hits.map(hit => ({
        fromX: hit.fromX,
        fromY: hit.fromY,
        toX: hit.toX,
        toY: hit.toY,
      })),
      hits: hits.map(hit => ({
        enemyIndex: hit.enemyIndex,
        damageMultiplier: hit.damageMultiplier,
      })),
    };
  }

  public calculate(chainLightning: ChainLightning): void {
    if (!chainLightning.applied) {
      chainLightning.applied = true;
      for (const hit of chainLightning.hits) {
        this.enemyService.hit(hit.enemyIndex, chainLightning.damage * hit.damageMultiplier, chainLightning.damageType);
      }
    }

    chainLightning.duration--;
    if (chainLightning.duration <= 0) {
      chainLightning.needdraw = false;
    }
  }
}
