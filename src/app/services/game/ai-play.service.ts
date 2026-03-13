import { Injectable, NgZone, inject } from '@angular/core';

import { BehaviorSubject, Subscription } from 'rxjs';

import { getActiveBalanceConfig } from '../../models/configs/turret-config.model';
import { Weapon } from '../../models/weapons/weapon.model';
import { getPolicyActions, getPolicyProfile } from '../../simulation/policy';
import { GameLoopService } from './game-loop.service';
import { GameStateService } from './game-state.service';
import { GridService } from './grid.service';
import { WaveService } from './wave.service';
import { TowerService } from '../towers/tower.service';

@Injectable({
  providedIn: 'root',
})
export class AiPlayService {
  private static readonly TICK_INTERVAL_MS = 750;

  private readonly gameLoopService = inject(GameLoopService);
  private readonly gameStateService = inject(GameStateService);
  private readonly waveService = inject(WaveService);
  private readonly towerService = inject(TowerService);
  private readonly gridService = inject(GridService);
  private readonly ngZone = inject(NgZone);

  private readonly policy = getPolicyProfile('mixed');
  private readonly enabledSubject = new BehaviorSubject<boolean>(false);
  private readonly blockedReasonSubject = new BehaviorSubject<string | null>(null);

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private waveStateSubscription: Subscription | null = null;
  private readonly recentWaveActionCounts = new Map<number, number>();

  public readonly isEnabled$ = this.enabledSubject.asObservable();

  public isEnabled(): boolean {
    return this.enabledSubject.value;
  }

  public toggle(): void {
    if (this.isEnabled()) {
      this.stop();
      return;
    }

    this.start();
  }

  public start(): void {
    if (this.isEnabled() || this.blockedReasonSubject.value !== null) {
      return;
    }

    this.enabledSubject.next(true);
    this.recentWaveActionCounts.clear();
    this.waveStateSubscription?.unsubscribe();
    this.waveStateSubscription = this.waveService.waveState$.subscribe(state => {
      if (state.phase === 'intermission') {
        this.recentWaveActionCounts.set(state.waveNumber, 0);
      }

      if (this.gameStateService.getBaseHealth() === 0) {
        this.stop();
      }
    });

    this.ngZone.runOutsideAngular(() => {
      this.tickHandle = setInterval(() => this.tick(), AiPlayService.TICK_INTERVAL_MS);
    });
  }

  public stop(): void {
    this.enabledSubject.next(false);

    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }

    this.waveStateSubscription?.unsubscribe();
    this.waveStateSubscription = null;
    this.recentWaveActionCounts.clear();
  }

  public setBlocked(blocked: boolean, reason: string | null = null): void {
    this.blockedReasonSubject.next(blocked ? reason ?? 'blocked' : null);
    if (blocked && this.isEnabled()) {
      this.stop();
    }
  }

  public tick(): void {
    if (!this.isEnabled()) {
      return;
    }

    if (this.blockedReasonSubject.value !== null || this.gameLoopService.paused || this.gameStateService.getBaseHealth() === 0) {
      if (this.gameStateService.getBaseHealth() === 0) {
        this.stop();
      }
      return;
    }

    const waveState = this.waveService.getCurrentState();
    const maxActions = waveState.phase === 'intermission' ? 3 : 1;
    const actions = getPolicyActions(
      {
        balance: getActiveBalanceConfig(),
        money: this.gameStateService.getMoney(),
        waveNumber: waveState.waveNumber,
        phase: waveState.phase,
        weapons: this.towerService.getWeapons().map(weapon => ({
          type: weapon.type,
          gridX: weapon.gridX,
          gridY: weapon.gridY,
          speedLevel: weapon.speedLevel,
          powerLevel: weapon.powerLevel,
          rangeLevel: weapon.rangeLevel,
        })),
      },
      this.policy,
      maxActions
    );

    let executed = 0;
    for (const action of actions) {
      const didExecute = action.kind === 'build' ? this.executeBuild(action.towerType, action.x, action.y, action.cost) : this.executeUpgrade(action);
      if (!didExecute) {
        continue;
      }

      executed++;
      this.recentWaveActionCounts.set(waveState.waveNumber, (this.recentWaveActionCounts.get(waveState.waveNumber) ?? 0) + 1);
    }

    if (waveState.phase === 'intermission' && this.shouldStartWaveEarly(waveState.waveNumber, executed)) {
      this.waveService.startWaveEarly();
    }
  }

  private executeBuild(towerType: Weapon['type'], x: number, y: number, expectedCost: number): boolean {
    if (!this.towerService.canPlaceTowerAtCell(x, y)) {
      return false;
    }

    const cost = this.towerService.getTowerBuildCost(towerType);
    if (cost !== expectedCost || this.gameStateService.getMoney() < cost) {
      return false;
    }

    this.towerService.createTower(towerType, x, y, 1, 1, 1);
    this.gameStateService.spendMoney(cost);
    return true;
  }

  private executeUpgrade(action: Extract<ReturnType<typeof getPolicyActions>[number], { kind: 'upgrade' }>): boolean {
    const weapon = this.towerService.getWeapons()[action.weaponIndex];
    if (!weapon) {
      return false;
    }

    const nextLevels = {
      speedLevel: action.upgradeType === 'speed' ? action.targetLevel : weapon.speedLevel,
      powerLevel: action.upgradeType === 'damage' ? action.targetLevel : weapon.powerLevel,
      rangeLevel: action.upgradeType === 'range' ? action.targetLevel : weapon.rangeLevel,
    };
    const cost = this.towerService.getUpgradeCost(weapon, nextLevels);
    if (cost !== action.cost || this.gameStateService.getMoney() < cost) {
      return false;
    }

    this.gameStateService.spendMoney(cost);
    this.towerService.upgradeTower(weapon, nextLevels);
    return true;
  }

  private shouldStartWaveEarly(waveNumber: number, executedThisTick: number): boolean {
    const intermissionActionCount = this.recentWaveActionCounts.get(waveNumber) ?? 0;
    if (executedThisTick > 0) {
      return false;
    }

    if (intermissionActionCount >= 3) {
      return true;
    }

    const cheapestTower = Math.min(...getActiveBalanceConfig().towers.map(tower => tower.cost));
    return this.gameStateService.getMoney() < cheapestTower;
  }
}
