import { Injectable, inject } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import {
  ArmorClass,
  DamageType,
  EnemyConfig,
  EnemyType,
  TurretConfig,
  UpgradeType,
  getDamageMultiplier,
  getDamageTypeForWeaponType,
  getTurretConfig,
  getTurretConfigs,
  enemyConfigs,
} from '../../models/configs/turret-config.model';
import { Cell } from '../../models/grid/grid';
import { EnemyEscapedEvent, WaveState } from '../../models/game/wave.model';
import { Weapon, WeaponType } from '../../models/weapons/weapon.model';
import { EnemyService } from '../enemies/enemy.service';
import { ExplosionService } from '../explosions/explosion.service';
import { GameLoopService } from '../game/game-loop.service';
import { GameStateService } from '../game/game-state.service';
import { GridService } from '../game/grid.service';
import { ProjectileService } from '../projectiles/projectile.service';
import { TowerService } from '../towers/tower.service';
import { WaveService, WaveServiceSnapshot } from '../game/wave.service';
import { balanceRuntimeConfig } from '../../models/configs/balance-runtime-config';

type TowerMetric = {
  type: WeaponType;
  damageType: DamageType;
  cost: number;
  dps: number;
  dpsPerGold: number;
};

export type ReplayWaveRow = {
  wave: number;
  enemyCount: number;
  avgHealth: number;
  avgSpeed: number;
  requiredDps: number;
  wallet: number;
  builtDps: number;
  pressureIndex: number;
  reward: number;
  leaks: number;
  buildSummary: string;
};

type ReplayBuildEvent = {
  wave: number;
  tower: WeaponType;
  x: number;
  y: number;
  cost: number;
};

type UpgradeCandidate = {
  weapon: Weapon;
  nextLevels: { speedLevel: number; powerLevel: number; rangeLevel: number };
  cost: number;
  score: number;
};

type ReplaySessionSnapshot = {
  gameState: { money: number; baseHealth: number };
  wave: WaveServiceSnapshot;
  towers: { weapons: Weapon[]; selectedWeapon: Weapon | null };
  enemies: { enemies: import('../../models/enemies/enemy-tank.model').EnemyTank[] };
  projectiles: { projectiles: import('../../models/projectiles/projectile.model').Projectile[] };
  explosions: { explosions: import('../../models/side-effects/explosion.model').Explosion[] };
  grid: { selectedCell: Cell | null };
  gameLoop: { paused: boolean; speed: number };
};

export type BalanceReplayConfig = {
  maxWaves: number;
  replaySpeed: number;
};

export type BalanceReplayState = {
  running: boolean;
  paused: boolean;
  maxWaves: number;
  replaySpeed: number;
  currentWave: number;
  money: number;
  baseHealth: number;
  leaks: number;
  buildLog: ReplayBuildEvent[];
  waveRows: ReplayWaveRow[];
  towerMetrics: TowerMetric[];
  damageByType: Record<DamageType, number>;
};

const DEFAULT_STATE: BalanceReplayState = {
  running: false,
  paused: false,
  maxWaves: 20,
  replaySpeed: 1,
  currentWave: 1,
  money: 0,
  baseHealth: 0,
  leaks: 0,
  buildLog: [],
  waveRows: [],
  towerMetrics: [],
  damageByType: {
    [DamageType.Bullet]: 0,
    [DamageType.Explosive]: 0,
    [DamageType.Energy]: 0,
    [DamageType.SlowExplosive]: 0,
  },
};

@Injectable({
  providedIn: 'root',
})
export class BalanceReplayService {
  private readonly gameLoopService = inject(GameLoopService);
  private readonly gameState = inject(GameStateService);
  private readonly waveService = inject(WaveService);
  private readonly towerService = inject(TowerService);
  private readonly enemyService = inject(EnemyService);
  private readonly projectileService = inject(ProjectileService);
  private readonly explosionService = inject(ExplosionService);
  private readonly gridService = inject(GridService);

  private replayIntervalId: number | null = null;
  private lastAutoBuildAt = 0;
  private waveRows = new Map<number, ReplayWaveRow>();
  private buildLog: ReplayBuildEvent[] = [];
  private leaks = 0;
  private snapshot: ReplaySessionSnapshot | null = null;

  private readonly replayState = new BehaviorSubject<BalanceReplayState>(DEFAULT_STATE);
  public readonly state$ = this.replayState.asObservable();

  public isReplayActive(): boolean {
    return this.replayState.value.running;
  }

  public start(config: BalanceReplayConfig): void {
    if (this.isReplayActive()) {
      this.stop();
    }

    const maxWaves = Math.max(1, Math.floor(config.maxWaves));
    const replaySpeed = Math.max(1, Math.min(4, Math.floor(config.replaySpeed)));
    this.snapshot = this.captureSnapshot();

    this.resetReplayState(maxWaves, replaySpeed);
    this.gameLoopService.setSpeed(replaySpeed);
    this.gameLoopService.setPaused(false);

    this.replayIntervalId = window.setInterval(() => this.tickReplay(maxWaves), 200);
  }

  public pause(): void {
    if (!this.isReplayActive()) {
      return;
    }

    this.gameLoopService.setPaused(true);
    this.pushState({ paused: true });
  }

  public resume(): void {
    if (!this.isReplayActive()) {
      return;
    }

    this.gameLoopService.setPaused(false);
    this.pushState({ paused: false });
  }

  public stop(): void {
    if (this.replayIntervalId !== null) {
      window.clearInterval(this.replayIntervalId);
      this.replayIntervalId = null;
    }

    if (this.snapshot) {
      this.restoreSnapshot(this.snapshot);
      this.snapshot = null;
    }

    this.replayState.next({
      ...this.replayState.value,
      running: false,
      paused: false,
    });
  }

  public handleEnemyEscaped(event: EnemyEscapedEvent): boolean {
    if (!this.isReplayActive()) {
      return false;
    }

    this.leaks += 1;
    this.gameState.damageBase(this.getBaseDamageForEnemyType(event.enemyType));
    this.updateCurrentWaveRow(this.waveService.getCurrentState());

    return true;
  }

  private captureSnapshot(): ReplaySessionSnapshot {
    return {
      gameState: this.gameState.getSnapshot(),
      wave: this.waveService.getSnapshot(),
      towers: this.towerService.getSnapshot(),
      enemies: this.enemyService.getSnapshot(),
      projectiles: this.projectileService.getSnapshot(),
      explosions: this.explosionService.getSnapshot(),
      grid: this.gridService.getSnapshot(),
      gameLoop: {
        paused: this.gameLoopService.paused,
        speed: this.gameLoopService.speed,
      },
    };
  }

  private restoreSnapshot(snapshot: ReplaySessionSnapshot): void {
    this.gameState.restoreSnapshot(snapshot.gameState);
    this.towerService.restoreSnapshot(snapshot.towers);
    this.enemyService.restoreSnapshot(snapshot.enemies);
    this.projectileService.restoreSnapshot(snapshot.projectiles);
    this.explosionService.restoreSnapshot(snapshot.explosions);
    this.gridService.restoreSnapshot(snapshot.grid);
    this.waveService.restoreSnapshot(snapshot.wave);
    this.gameLoopService.setSpeed(snapshot.gameLoop.speed);
    this.gameLoopService.setPaused(snapshot.gameLoop.paused);
  }

  private resetReplayState(maxWaves: number, replaySpeed: number): void {
    this.waveRows.clear();
    this.buildLog = [];
    this.leaks = 0;
    this.lastAutoBuildAt = 0;

    this.towerService.restoreSnapshot({ weapons: [], selectedWeapon: null });
    this.enemyService.restoreSnapshot({ enemies: [] });
    this.enemyService.resetDamageStats();
    this.projectileService.restoreSnapshot({ projectiles: [] });
    this.explosionService.restoreSnapshot({ explosions: [] });

    this.gridService.setupLevelOne();
    this.gridService.restoreSnapshot({ selectedCell: null });
    this.gameState.restoreSnapshot({ money: Math.round(balanceRuntimeConfig.economy.startMoney), baseHealth: 20 });
    this.waveService.initialize();

    this.replayState.next({
      running: true,
      paused: false,
      maxWaves,
      replaySpeed,
      currentWave: 1,
      money: this.gameState.getMoney(),
      baseHealth: this.gameState.getBaseHealth(),
      leaks: 0,
      buildLog: [],
      waveRows: [],
      towerMetrics: this.getTowerMetrics(),
      damageByType: this.enemyService.getDamageStats(),
    });
  }

  private tickReplay(maxWaves: number): void {
    if (!this.isReplayActive()) {
      return;
    }

    const waveState = this.waveService.getCurrentState();
    const now = Date.now();

    if (now - this.lastAutoBuildAt > 350) {
      this.autoBuild(waveState);
      this.lastAutoBuildAt = now;
    }

    this.updateCurrentWaveRow(waveState);

    if (this.gameState.getBaseHealth() <= 0 || waveState.waveNumber > maxWaves) {
      this.stop();
    }
  }

  private autoBuild(waveState: WaveState): void {
    const reserve = this.getReserveMoney(waveState);
    const availableBudget = this.gameState.getMoney() - reserve;
    if (availableBudget <= 0) {
      return;
    }

    const towerMetrics = this.getTowerMetrics();
    if (towerMetrics.length === 0) {
      return;
    }

    const enemyArmorWeights = this.getExpectedEnemyArmorWeights(waveState.waveNumber);
    const builtTowerCounts = this.getBuiltTowerCounts();
    const currentMix = this.getCurrentDamageTypeMix();

    const affordableTowers = towerMetrics.filter(metric => metric.cost <= availableBudget);
    if (affordableTowers.length === 0) {
      return;
    }

    affordableTowers.sort(
      (a, b) =>
      this.getTowerBuildScore(b, enemyArmorWeights, builtTowerCounts, currentMix, waveState.waveNumber) -
      this.getTowerBuildScore(a, enemyArmorWeights, builtTowerCounts, currentMix, waveState.waveNumber)
    );
    const bestTower = affordableTowers[0];
    const bestBuildScore = this.getTowerBuildScore(bestTower, enemyArmorWeights, builtTowerCounts, currentMix, waveState.waveNumber);

    const bestUpgrade = this.getBestUpgradeCandidate(availableBudget, enemyArmorWeights, currentMix, waveState.waveNumber);
    if (bestUpgrade && bestUpgrade.score >= bestBuildScore * balanceRuntimeConfig.ai.upgradePreference) {
      this.towerService.upgradeTower(bestUpgrade.weapon, bestUpgrade.nextLevels);
      this.gameState.spendMoney(bestUpgrade.cost);
      return;
    }

    const cell = this.pickBestBuildCell(waveState.waveNumber);
    if (!cell) {
      return;
    }

    this.towerService.createTower(bestTower.type, cell.x, cell.y, 1, 1, 1);
    this.gameState.spendMoney(bestTower.cost);

    this.buildLog.push({
      wave: waveState.waveNumber,
      tower: bestTower.type,
      x: cell.x,
      y: cell.y,
      cost: bestTower.cost,
    });
  }

  private pickBestBuildCell(currentWave: number): Cell | null {
    const routeCellKeys = new Set(this.gridService.route.map(cell => `${cell.x}:${cell.y}`));
    const occupiedCellKeys = new Set(this.towerService.getWeapons().map(weapon => `${weapon.gridX}:${weapon.gridY}`));
    const candidates: Cell[] = [];

    for (const column of this.gridService.grid) {
      for (const cell of column) {
        const key = `${cell.x}:${cell.y}`;
        if (routeCellKeys.has(key) || occupiedCellKeys.has(key)) {
          continue;
        }
        candidates.push(cell);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const targetRouteIndex = this.getTargetRouteIndex(currentWave);
    candidates.sort((a, b) => this.getRouteInfluenceScore(a, targetRouteIndex) - this.getRouteInfluenceScore(b, targetRouteIndex));
    return candidates[0];
  }

  private getRouteInfluenceScore(cell: Cell, targetRouteIndex: number): number {
    const cellCenterX = cell.drawx + cell.width / 2;
    const cellCenterY = cell.drawy + cell.height / 2;
    let minDistance = Number.POSITIVE_INFINITY;
    let nearestRouteIndex = 0;

    for (let i = 0; i < this.gridService.route.length; i++) {
      const routeCell = this.gridService.route[i];
      const routeCenterX = routeCell.drawx + routeCell.width / 2;
      const routeCenterY = routeCell.drawy + routeCell.height / 2;
      const distance = Math.hypot(cellCenterX - routeCenterX, cellCenterY - routeCenterY);
      if (distance < minDistance) {
        minDistance = distance;
        nearestRouteIndex = i;
      }
    }

    const pathSpreadPenalty = Math.abs(nearestRouteIndex - targetRouteIndex) * 1.6;
    const clusterPenalty = this.getClusterPenalty(cell);

    return minDistance * 3.5 + pathSpreadPenalty + clusterPenalty;
  }

  private getTargetRouteIndex(currentWave: number): number {
    const routeLength = this.gridService.route.length;
    if (routeLength === 0) {
      return 0;
    }

    const anchors = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85];
    const builtCount = this.towerService.getWeapons().length;
    const anchor = anchors[(builtCount + currentWave) % anchors.length];
    return Math.floor((routeLength - 1) * anchor);
  }

  private getClusterPenalty(cell: Cell): number {
    let penalty = 0;
    for (const tower of this.towerService.getWeapons()) {
      const distance = Math.abs(tower.gridX - cell.x) + Math.abs(tower.gridY - cell.y);
      if (distance < 4) {
        penalty += (4 - distance) * 40;
      }
    }

    return penalty;
  }

  private updateCurrentWaveRow(waveState: WaveState): void {
    const profile = this.expectedWaveProfile(waveState.waveNumber);
    const spawnDurationSec = ((profile.count - 1) * this.getSpawnIntervalMs(waveState.waveNumber)) / 1000;
    const travelDurationSec = this.computeRouteLength(this.gridService.route) / profile.avgSpeed;
    const waveDurationSec = Math.max(1, spawnDurationSec + travelDurationSec);

    const requiredDps = profile.totalWaveHealth / waveDurationSec;
    const builtDps = this.calculateCurrentBuiltDps();
    const pressureIndex = requiredDps > 0 ? builtDps / requiredDps : 0;
    const row: ReplayWaveRow = {
      wave: waveState.waveNumber,
      enemyCount: profile.count,
      avgHealth: profile.avgHealth,
      avgSpeed: profile.avgSpeed,
      requiredDps,
      wallet: this.gameState.getMoney(),
      builtDps,
      pressureIndex,
      reward: profile.totalWaveReward,
      leaks: this.leaks,
      buildSummary: this.toBuildSummary(waveState.waveNumber),
    };

    this.waveRows.set(waveState.waveNumber, row);
    this.pushState({
      currentWave: waveState.waveNumber,
      money: this.gameState.getMoney(),
      baseHealth: this.gameState.getBaseHealth(),
      leaks: this.leaks,
      buildLog: [...this.buildLog],
      waveRows: Array.from(this.waveRows.values()).sort((a, b) => a.wave - b.wave),
      damageByType: this.enemyService.getDamageStats(),
    });
  }

  private calculateCurrentBuiltDps(): number {
    return this.towerService.getWeapons().reduce((total, weapon) => total + weapon.damage / (weapon.speed / 1000), 0);
  }

  private toBuildSummary(waveNumber: number): string {
    const buildsInWave = this.buildLog.filter(build => build.wave === waveNumber);
    if (buildsInWave.length === 0) {
      return 'none';
    }

    const grouped = buildsInWave.reduce<Record<string, number>>((acc, build) => {
      acc[build.tower] = (acc[build.tower] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([tower, count]) => `${count}x ${tower}`)
      .join(', ');
  }

  private getTowerMetrics(): TowerMetric[] {
    return getTurretConfigs()
      .map(config => {
        const damage = this.getUpgradeValue(config, UpgradeType.Damage, 1);
        const speedMs = this.getUpgradeValue(config, UpgradeType.Speed, 1);
        const dps = damage / (speedMs / 1000);
        return {
          type: config.type,
          damageType: getDamageTypeForWeaponType(config.type),
          cost: config.cost,
          dps,
          dpsPerGold: dps / config.cost,
        };
      })
      .sort((a, b) => b.dpsPerGold - a.dpsPerGold);
  }

  private getBuiltTowerCounts(): Map<WeaponType, number> {
    const counts = new Map<WeaponType, number>();
    for (const build of this.buildLog) {
      counts.set(build.tower, (counts.get(build.tower) ?? 0) + 1);
    }
    return counts;
  }

  private getExpectedEnemyArmorWeights(waveNumber: number): Partial<Record<ArmorClass, number>> {
    const unlocked = this.getUnlockedEnemyConfigs(waveNumber);
    const weights = this.getNormalizedWeights(this.getEnemyWeights(unlocked, waveNumber));
    const mix: Partial<Record<ArmorClass, number>> = {};
    for (let i = 0; i < unlocked.length; i++) {
      const armorClass = unlocked[i].armorClass;
      mix[armorClass] = (mix[armorClass] ?? 0) + weights[i];
    }
    return mix;
  }

  private getTowerBuildScore(
    metric: TowerMetric,
    enemyArmorWeights: Partial<Record<ArmorClass, number>>,
    builtTowerCounts: Map<WeaponType, number>,
    currentMix: Record<DamageType, number>,
    waveNumber: number
  ): number {
    const coverageWeight = this.getCoverageWeight(metric.damageType, enemyArmorWeights);
    const existingCount = builtTowerCounts.get(metric.type) ?? 0;
    const diversityFactor = 1 / (1 + existingCount * balanceRuntimeConfig.ai.diversityPenalty);
    const compositionBoost = this.getCompositionBoost(metric.damageType, currentMix, waveNumber);
    return metric.dpsPerGold * coverageWeight * diversityFactor * compositionBoost;
  }

  private getCoverageWeight(damageType: DamageType, enemyArmorWeights: Partial<Record<ArmorClass, number>>): number {
    let weighted = 0;
    for (const [armorClass, weight] of Object.entries(enemyArmorWeights) as [ArmorClass, number][]) {
      weighted += getDamageMultiplier(damageType, armorClass) * weight;
    }
    return weighted || 1;
  }

  private getUpgradeValue(config: TurretConfig, type: UpgradeType, level: number): number {
    const upgrade = config.upgrades.find(item => item.type === type);
    if (!upgrade) {
      throw new Error(`Missing upgrade type '${type}'`);
    }
    const detail = upgrade.details.find(item => item.level === level);
    if (!detail) {
      throw new Error(`Missing level ${level} in '${type}'`);
    }
    return detail.value;
  }

  private getUpgradeCost(config: TurretConfig, type: UpgradeType, level: number): number {
    const upgrade = config.upgrades.find(item => item.type === type);
    if (!upgrade) {
      throw new Error(`Missing upgrade type '${type}'`);
    }
    const detail = upgrade.details.find(item => item.level === level);
    if (!detail) {
      throw new Error(`Missing level ${level} in '${type}'`);
    }
    return detail.cost;
  }

  private getCurrentDamageTypeMix(): Record<DamageType, number> {
    const totals: Record<DamageType, number> = {
      [DamageType.Bullet]: 0,
      [DamageType.Explosive]: 0,
      [DamageType.Energy]: 0,
      [DamageType.SlowExplosive]: 0,
    };

    for (const weapon of this.towerService.getWeapons()) {
      const damageType = getDamageTypeForWeaponType(weapon.type);
      totals[damageType] += weapon.damage / (weapon.speed / 1000);
    }

    return totals;
  }

  private getDamageTypeTargets(waveNumber: number): Record<DamageType, number> {
    if (waveNumber <= 5) {
      return {
        [DamageType.Bullet]: 0.4,
        [DamageType.Explosive]: 0.35,
        [DamageType.Energy]: 0.2,
        [DamageType.SlowExplosive]: 0.05,
      };
    }
    if (waveNumber <= 10) {
      return {
        [DamageType.Bullet]: 0.3,
        [DamageType.Explosive]: 0.35,
        [DamageType.Energy]: 0.25,
        [DamageType.SlowExplosive]: 0.1,
      };
    }

    return {
      [DamageType.Bullet]: 0.22,
      [DamageType.Explosive]: 0.33,
      [DamageType.Energy]: 0.3,
      [DamageType.SlowExplosive]: 0.15,
    };
  }

  private getCompositionBoost(damageType: DamageType, currentMix: Record<DamageType, number>, waveNumber: number): number {
    const totalDps =
      currentMix[DamageType.Bullet] +
      currentMix[DamageType.Explosive] +
      currentMix[DamageType.Energy] +
      currentMix[DamageType.SlowExplosive];
    const targets = this.getDamageTypeTargets(waveNumber);
    const currentShare = totalDps > 0 ? currentMix[damageType] / totalDps : 0;
    const deficit = Math.max(0, targets[damageType] - currentShare);
    return 1 + deficit * balanceRuntimeConfig.ai.compositionStrength;
  }

  private getReserveMoney(waveState: WaveState): number {
    if (waveState.phase === 'intermission') {
      if (waveState.intermissionRemainingMs <= 1200) {
        return 0;
      }
        return Math.min(
          90,
          balanceRuntimeConfig.economy.reserveIntermissionBase +
            waveState.waveNumber * balanceRuntimeConfig.economy.reserveIntermissionPerWave
        );
    }

    if (waveState.phase === 'spawning') {
      return Math.min(
        120,
        balanceRuntimeConfig.economy.reserveSpawningBase + waveState.waveNumber * balanceRuntimeConfig.economy.reserveSpawningPerWave
      );
    }

    return Math.min(
      80,
      balanceRuntimeConfig.economy.reserveCleanupBase + waveState.waveNumber * balanceRuntimeConfig.economy.reserveCleanupPerWave
    );
  }

  private getBestUpgradeCandidate(
    availableBudget: number,
    enemyArmorWeights: Partial<Record<ArmorClass, number>>,
    currentMix: Record<DamageType, number>,
    waveNumber: number
  ): UpgradeCandidate | null {
    const candidates: UpgradeCandidate[] = [];

    for (const weapon of this.towerService.getWeapons()) {
      const config = getTurretConfig(weapon.type);
      const damageType = getDamageTypeForWeaponType(weapon.type);
      const currentDps = weapon.damage / (weapon.speed / 1000);

      if (weapon.powerLevel < 5) {
        const nextPowerLevel = weapon.powerLevel + 1;
        const newDamage = this.getUpgradeValue(config, UpgradeType.Damage, nextPowerLevel);
        const cost = this.getUpgradeCost(config, UpgradeType.Damage, nextPowerLevel);
        if (cost <= availableBudget) {
          const upgradedDps = newDamage / (weapon.speed / 1000);
          const dpsGain = upgradedDps - currentDps;
          if (dpsGain > 0) {
          const score =
            (dpsGain / cost) *
            this.getCoverageWeight(damageType, enemyArmorWeights) *
            this.getCompositionBoost(damageType, currentMix, waveNumber);
            candidates.push({
              weapon,
              nextLevels: {
                speedLevel: weapon.speedLevel,
                powerLevel: nextPowerLevel,
                rangeLevel: weapon.rangeLevel,
              },
              cost,
              score,
            });
          }
        }
      }

      if (weapon.speedLevel < 5) {
        const nextSpeedLevel = weapon.speedLevel + 1;
        const newSpeed = this.getUpgradeValue(config, UpgradeType.Speed, nextSpeedLevel);
        const cost = this.getUpgradeCost(config, UpgradeType.Speed, nextSpeedLevel);
        if (cost <= availableBudget && newSpeed > 0) {
          const upgradedDps = weapon.damage / (newSpeed / 1000);
          const dpsGain = upgradedDps - currentDps;
          if (dpsGain > 0) {
          const score =
            (dpsGain / cost) *
            this.getCoverageWeight(damageType, enemyArmorWeights) *
            this.getCompositionBoost(damageType, currentMix, waveNumber);
            candidates.push({
              weapon,
              nextLevels: {
                speedLevel: nextSpeedLevel,
                powerLevel: weapon.powerLevel,
                rangeLevel: weapon.rangeLevel,
              },
              cost,
              score,
            });
          }
        }
      }

      if (weapon.rangeLevel < 5) {
        const nextRangeLevel = weapon.rangeLevel + 1;
        const cost = this.getUpgradeCost(config, UpgradeType.Range, nextRangeLevel);
        if (cost <= availableBudget) {
          const rangeGainFactor = balanceRuntimeConfig.ai.rangeUtilityPerLevel * nextRangeLevel;
          const dpsGain = currentDps * rangeGainFactor;
          if (dpsGain > 0) {
            const score =
              (dpsGain / cost) *
              this.getCoverageWeight(damageType, enemyArmorWeights) *
              this.getCompositionBoost(damageType, currentMix, waveNumber);
            candidates.push({
              weapon,
              nextLevels: {
                speedLevel: weapon.speedLevel,
                powerLevel: weapon.powerLevel,
                rangeLevel: nextRangeLevel,
              },
              cost,
              score,
            });
          }
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  private expectedWaveProfile(waveNumber: number): {
    count: number;
    avgHealth: number;
    avgSpeed: number;
    totalWaveHealth: number;
    totalWaveReward: number;
  } {
    const unlocked = this.getUnlockedEnemyConfigs(waveNumber);
    const count = this.getWaveEnemyCount(waveNumber);
    const weights = this.getNormalizedWeights(this.getEnemyWeights(unlocked, waveNumber));

    const healthMultiplier = 1 + (waveNumber - 1) * balanceRuntimeConfig.wave.healthGrowth;
    const speedMultiplier = Math.min(1.45, 1 + (waveNumber - 1) * balanceRuntimeConfig.wave.speedGrowth);
    const earlyWaveHealthMultiplier = waveNumber <= balanceRuntimeConfig.wave.earlyWaves ? balanceRuntimeConfig.wave.earlyHealthMultiplier : 1;
    const earlyWaveSpeedMultiplier = waveNumber <= balanceRuntimeConfig.wave.earlyWaves ? balanceRuntimeConfig.wave.earlySpeedMultiplier : 1;
    const rewardMultiplier = 1 + (waveNumber - 1) * balanceRuntimeConfig.wave.rewardGrowth;

    let avgHealth = 0;
    let avgSpeed = 0;
    let avgReward = 0;
    for (let i = 0; i < unlocked.length; i++) {
      const enemy = unlocked[i];
      const weight = weights[i];
      avgHealth += enemy.health * healthMultiplier * earlyWaveHealthMultiplier * weight;
      avgSpeed += enemy.speed * speedMultiplier * earlyWaveSpeedMultiplier * weight;
      avgReward += enemy.reward * rewardMultiplier * weight;
    }

    return {
      count,
      avgHealth,
      avgSpeed,
      totalWaveHealth: avgHealth * count,
      totalWaveReward: avgReward * count,
    };
  }

  private getWaveEnemyCount(waveNumber: number): number {
    return waveNumber === 1 ? 2 : 3 + Math.floor((waveNumber - 1) * balanceRuntimeConfig.wave.countGrowth);
  }

  private getSpawnIntervalMs(waveNumber: number): number {
    return Math.max(
      balanceRuntimeConfig.wave.spawnMinMs,
      balanceRuntimeConfig.wave.spawnBaseMs - (waveNumber - 1) * balanceRuntimeConfig.wave.spawnDecayMs
    );
  }

  private getUnlockedEnemyConfigs(waveNumber: number): EnemyConfig[] {
    if (waveNumber <= 3) {
      return enemyConfigs.slice(0, 1);
    }
    if (waveNumber <= 5) {
      return enemyConfigs.slice(0, 2);
    }
    if (waveNumber <= 7) {
      return enemyConfigs.slice(0, 3);
    }
    if (waveNumber <= 9) {
      return enemyConfigs.slice(0, 5);
    }
    if (waveNumber <= 11) {
      return enemyConfigs.slice(0, 7);
    }
    if (waveNumber <= 13) {
      return enemyConfigs.slice(0, 9);
    }

    return enemyConfigs;
  }

  private getEnemyWeights(unlockedEnemies: EnemyConfig[], waveNumber: number): number[] {
    return unlockedEnemies.map((_, index) => 1 + index * 0.25 + (waveNumber - 1) * index * 0.03);
  }

  private getNormalizedWeights(weights: number[]): number[] {
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map(weight => weight / total);
  }

  private computeRouteLength(route: { drawx: number; drawy: number }[]): number {
    let length = 0;
    for (let i = 1; i < route.length; i++) {
      const dx = route[i].drawx - route[i - 1].drawx;
      const dy = route[i].drawy - route[i - 1].drawy;
      length += Math.hypot(dx, dy);
    }
    return length;
  }

  private getBaseDamageForEnemyType(enemyType: EnemyType): number {
    switch (enemyType) {
      case EnemyType.ScoutTank:
      case EnemyType.SiegeTank:
      case EnemyType.LightHovercraft:
      case EnemyType.HeavyHovercraft:
        return 2;
      case EnemyType.FighterPlane:
      case EnemyType.BomberPlane:
      case EnemyType.Boss:
        return 3;
      default:
        return 1;
    }
  }

  private pushState(patch: Partial<BalanceReplayState>): void {
    this.replayState.next({
      ...this.replayState.value,
      ...patch,
    });
  }
}
