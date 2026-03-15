import { delta } from '../models/constants';
import {
  BalanceConfig,
  DamageType,
  EnemyConfig,
  EnemyType,
  FlameBubbleConfig,
  SplitRocketConfig,
  UpgradeDetails,
  UpgradeType,
  getDamageTypeForWeaponType,
} from '../models/configs/turret-config.model';
import { EnemyTank } from '../models/enemies/enemy-tank.model';
import { Cell } from '../models/grid/grid';
import { Projectile, ChainLightning, FlameBubble, Grenade, Laser, Rocket } from '../models/projectiles/projectile.model';
import { ProjectileType } from '../models/projectiles/projectile-type.model';
import { Weapon } from '../models/weapons/weapon.model';
import { WeaponType } from '../models/weapons/weapon.model';
import { LEVEL_ONE_ROUTE, getLevelOneBuildableCells } from '../models/levels/level-one-layout';
import { WavePhase } from '../models/game/wave.model';
import { resolveChainLightningShot } from './chain-lightning';
import { getFlameBubbleAngles } from './flame-bubble';
import { selectSplitRocketTargets } from './split-rocket';
import { calculatePlacementScore, getRankedPlacementCandidates } from './placement';
import { SimulationPolicy, SimulationPolicyName, applyWeaponUpgradeLevel, getPolicyActions, getPolicyProfiles } from './policy';
import { RandomSource, createSeededRandom } from './random';
import { TimedWaveEnemySpawn, WaveEnemySpawnPlan, createTimedWaveSpawnSchedule, createWaveSpawnPlan } from './wave-generation';
import {
  WavePerformanceMetrics,
  calculateAdaptivePressure,
  createWavePerformanceMetrics,
  recordResolvedEnemyProgress,
  updateWaveMetricsForAliveEnemies,
} from './adaptive-pressure';

export type SimulationScoreBreakdown = {
  challenge: number;
  spendPressure: number;
  diversity: number;
  antiHoarding: number;
  stability: number;
  total: number;
};

export type SimulationResult = {
  policy: SimulationPolicyName;
  seed: number;
  finalWave: number;
  victory: boolean;
  baseHealthRemaining: number;
  moneyEarned: number;
  moneySpent: number;
  moneyHoardedPeak: number;
  towerBuildCounts: Partial<Record<WeaponType, number>>;
  towerUpgradeCounts: Partial<Record<WeaponType, number>>;
  leakCounts: Partial<Record<EnemyType, number>>;
  damageByType: Partial<Record<DamageType, number>>;
  buildTimeline: Array<{ wave: number; type: WeaponType; x: number; y: number }>;
  score: SimulationScoreBreakdown;
  averageSpendRatio: number;
  totalTicks: number;
};

export type SoloTowerProbeResult = {
  towerType: WeaponType;
  x: number;
  y: number;
  finalWave: number;
  baseHealthRemaining: number;
};

type EconomyState = {
  money: number;
  moneyEarned: number;
  moneySpent: number;
  moneyHoardedPeak: number;
  baseHealth: number;
};

type WaveState = {
  waveNumber: number;
  phase: WavePhase;
  timeUntilNextWaveMs: number;
  activeWindows: Array<{
    waveNumber: number;
    spawns: TimedWaveEnemySpawn[];
    elapsedMs: number;
    spawnedCount: number;
    metrics: WavePerformanceMetrics;
  }>;
  nextWaveNumber: number;
  lastPressureEvaluatedWave: number;
  adaptivePressure: number;
  maxWaveLimit: number | null;
};

type SimulationState = {
  balance: BalanceConfig;
  economy: EconomyState;
  wave: WaveState;
  enemies: EnemyTank[];
  projectiles: Projectile[];
  weapons: Weapon[];
  random: RandomSource;
  leakCounts: Partial<Record<EnemyType, number>>;
  damageByType: Partial<Record<DamageType, number>>;
  towerBuildCounts: Partial<Record<WeaponType, number>>;
  towerUpgradeCounts: Partial<Record<WeaponType, number>>;
  buildTimeline: Array<{ wave: number; type: WeaponType; x: number; y: number }>;
  spendRatioSamples: number[];
  totalTicks: number;
};

const TICK_MS = delta * 1000;
export const DEFAULT_MAX_SIMULATION_WAVE = 80;

export { getPolicyProfiles };

function getTargetChallengeWave(maxWave: number): number {
  return Math.max(10, Math.min(18, Math.round(maxWave * 0.3)));
}

export function createInitialSimulationState(balance: BalanceConfig, seed: number): SimulationState {
  return {
    balance,
    economy: {
      money: balance.economy.startingMoney,
      moneyEarned: 0,
      moneySpent: 0,
      moneyHoardedPeak: balance.economy.startingMoney,
      baseHealth: balance.economy.startingBaseHealth,
    },
    wave: {
      waveNumber: 1,
      phase: 'waiting',
      timeUntilNextWaveMs: balance.waves.initialWaveCountdownMs,
      activeWindows: [],
      nextWaveNumber: 1,
      lastPressureEvaluatedWave: 0,
      adaptivePressure: 0,
      maxWaveLimit: null,
    },
    enemies: [],
    projectiles: [],
    weapons: [],
    random: createSeededRandom(seed),
    leakCounts: {},
    damageByType: {},
    towerBuildCounts: {},
    towerUpgradeCounts: {},
    buildTimeline: [],
    spendRatioSamples: [],
    totalTicks: 0,
  };
}

export function simulateBalance(balance: BalanceConfig, policy: SimulationPolicy, seed: number, maxWave = DEFAULT_MAX_SIMULATION_WAVE): SimulationResult {
  const state = createInitialSimulationState(balance, seed);
  state.wave.maxWaveLimit = maxWave;

  while (state.economy.baseHealth > 0) {
    if (state.wave.nextWaveNumber > maxWave && state.wave.activeWindows.length === 0 && state.enemies.every(enemy => enemy.lives <= 0)) {
      break;
    }

    if (isPlanningWindow(state) || policy.allowWaveBuilds) {
      applyPolicy(state, policy);
    }

    tickSimulation(state);
  }

  const averageSpendRatio =
    state.spendRatioSamples.length === 0
      ? 0
      : state.spendRatioSamples.reduce((sum, value) => sum + value, 0) / state.spendRatioSamples.length;
  const score = scoreSimulation(state, policy, averageSpendRatio, maxWave);

  return {
    policy: policy.name,
    seed,
    finalWave: Math.max(1, state.wave.nextWaveNumber - 1),
    victory: state.economy.baseHealth > 0 && state.wave.nextWaveNumber > maxWave,
    baseHealthRemaining: state.economy.baseHealth,
    moneyEarned: state.economy.moneyEarned,
    moneySpent: state.economy.moneySpent,
    moneyHoardedPeak: state.economy.moneyHoardedPeak,
    towerBuildCounts: { ...state.towerBuildCounts },
    towerUpgradeCounts: { ...state.towerUpgradeCounts },
    leakCounts: { ...state.leakCounts },
    damageByType: { ...state.damageByType },
    buildTimeline: [...state.buildTimeline],
    score,
    averageSpendRatio,
    totalTicks: state.totalTicks,
  };
}

export function tickSimulation(state: SimulationState): void {
  tickWave(state, TICK_MS);
  calculateEnemies(state);
  calculateWeapons(state);
  calculateProjectiles(state);

  state.totalTicks++;
  state.economy.moneyHoardedPeak = Math.max(state.economy.moneyHoardedPeak, state.economy.money);
  const totalEconomicFlow = state.economy.moneySpent + state.economy.money;
  if (totalEconomicFlow > 0) {
    state.spendRatioSamples.push(state.economy.moneySpent / totalEconomicFlow);
  }
}

function tickWave(state: SimulationState, dtMs: number): void {
  const waveState = state.wave;
  const aliveEnemies = state.enemies.filter(enemy => enemy.lives > 0).length;
  updateActiveWaveMetrics(state, dtMs);

  waveState.timeUntilNextWaveMs -= dtMs;
  while (waveState.timeUntilNextWaveMs <= 0) {
    if (waveState.maxWaveLimit !== null && waveState.nextWaveNumber > waveState.maxWaveLimit) {
      waveState.timeUntilNextWaveMs = 0;
      break;
    }
    startScheduledWave(state);
    waveState.timeUntilNextWaveMs += state.balance.waves.waveDurationMs;
  }

  advanceWaveWindows(state, dtMs);

  if (waveState.activeWindows.some(window => window.spawnedCount < window.spawns.length)) {
    waveState.phase = 'spawning';
    waveState.waveNumber = waveState.nextWaveNumber - 1;
    return;
  }

  waveState.phase = aliveEnemies > 0 ? 'cleanup' : 'waiting';
  waveState.waveNumber = waveState.nextWaveNumber === 1 ? 1 : waveState.nextWaveNumber - 1;
}

function startScheduledWave(state: SimulationState): void {
  const waveNumber = state.wave.nextWaveNumber;
  if (waveNumber > 1 && state.wave.lastPressureEvaluatedWave < waveNumber - 1) {
    const previousWindow = state.wave.activeWindows.find(window => window.waveNumber === waveNumber - 1);
    if (previousWindow) {
      state.wave.adaptivePressure = calculateAdaptivePressure(state.wave.adaptivePressure, previousWindow.waveNumber, previousWindow.metrics);
      state.wave.lastPressureEvaluatedWave = previousWindow.waveNumber;
    }
  }

  const plan = createWaveSpawnPlan(waveNumber, state.balance.enemies, state.balance.waves, state.random, state.wave.adaptivePressure);
  state.wave.activeWindows.push({
    waveNumber,
    spawns: createTimedWaveSpawnSchedule(plan, waveNumber, state.balance.waves.waveDurationMs),
    elapsedMs: 0,
    spawnedCount: 0,
    metrics: createWavePerformanceMetrics(),
  });
  state.wave.waveNumber = waveNumber;
  state.wave.nextWaveNumber++;
}

function advanceWaveWindows(state: SimulationState, dtMs: number): void {
  for (const window of state.wave.activeWindows) {
    window.elapsedMs += dtMs;

    while (window.spawnedCount < window.spawns.length && window.spawns[window.spawnedCount].spawnOffsetMs <= window.elapsedMs) {
      spawnEnemy(state, window.spawns[window.spawnedCount].enemyConfig, window.waveNumber);
      window.spawnedCount++;
    }
  }

  state.wave.activeWindows = state.wave.activeWindows.filter(
    window =>
      window.spawnedCount < window.spawns.length ||
      hasAliveEnemiesForWave(state, window.waveNumber) ||
      (window.waveNumber > state.wave.lastPressureEvaluatedWave &&
        (state.wave.maxWaveLimit === null || window.waveNumber < state.wave.maxWaveLimit))
  );
}

function updateActiveWaveMetrics(state: SimulationState, dtMs: number): void {
  for (const window of state.wave.activeWindows) {
    const aliveEnemies = state.enemies.filter(enemy => enemy.lives > 0 && getWaveNumberForEnemy(enemy) === window.waveNumber);
    updateWaveMetricsForAliveEnemies(window.metrics, aliveEnemies, dtMs);
  }
}

function hasAliveEnemiesForWave(state: SimulationState, waveNumber: number): boolean {
  return state.enemies.some(enemy => enemy.lives > 0 && getWaveNumberForEnemy(enemy) === waveNumber);
}

function spawnEnemy(state: SimulationState, enemyConfig: EnemyConfig, waveNumber: number): void {
  const routeEntry = LEVEL_ONE_ROUTE[LEVEL_ONE_ROUTE.length - 1];
  state.enemies.push({
    reward: enemyConfig.reward,
    lives: enemyConfig.health,
    maxLives: enemyConfig.health,
    imageIndex: 0,
    armorClass: enemyConfig.armorClass,
    drawx: routeEntry.drawx,
    drawy: routeEntry.drawy,
    routeindex: LEVEL_ONE_ROUTE.length - 1,
    curveStartx: null,
    curveStarty: null,
    curveEndx: null,
    curveEndy: null,
    bezierx: null,
    beziery: null,
    t: 0,
    angle: 0,
    died: false,
    escaped: false,
    speed: enemyConfig.speed,
    docurve: false,
    waveNumber,
  } as EnemyTank & { waveNumber: number });
}

function calculateEnemies(state: SimulationState): void {
  state.enemies.forEach(enemy => calculateEnemy(enemy));

  for (const enemy of state.enemies) {
    if (enemy.lives <= 0 && !enemy.died && !enemy.escaped) {
      const metrics = getMetricsForWave(state, getWaveNumberForEnemy(enemy));
      if (metrics) {
        recordResolvedEnemyProgress(metrics, enemy);
      }
      enemy.died = true;
      state.economy.money += enemy.reward;
      state.economy.moneyEarned += enemy.reward;
    }

    if (enemy.escaped && !enemy.died) {
      const metrics = getMetricsForWave(state, getWaveNumberForEnemy(enemy));
      if (metrics) {
        recordResolvedEnemyProgress(metrics, enemy);
      }
      enemy.died = true;
      const enemyType = getEnemyTypeForEnemyStats(state.balance.enemies, enemy);
      if (enemyType) {
        state.leakCounts[enemyType] = (state.leakCounts[enemyType] ?? 0) + 1;
        const config = state.balance.enemies.find(entry => entry.type === enemyType);
        state.economy.baseHealth = Math.max(0, state.economy.baseHealth - (config?.baseDamageToBase ?? 1));
      }
    }
  }
}

function getWaveNumberForEnemy(enemy: EnemyTank): number {
  return (enemy as EnemyTank & { waveNumber?: number }).waveNumber ?? 0;
}

function getMetricsForWave(state: SimulationState, waveNumber: number): WavePerformanceMetrics | null {
  return state.wave.activeWindows.find(window => window.waveNumber === waveNumber)?.metrics ?? null;
}

function calculateEnemy(enemyTank: EnemyTank): void {
  if (enemyTank.lives <= 0) {
    return;
  }

  if (enemyTank.routeindex < 0 || enemyTank.routeindex >= LEVEL_ONE_ROUTE.length) {
    return;
  }

  const oldDrawx = enemyTank.drawx;
  const oldDrawy = enemyTank.drawy;

  if (enemyTank.docurve) {
    calculateEnemyCurve(enemyTank);
  } else {
    moveEnemyTowardsRoute(enemyTank);
  }

  const movementDx = enemyTank.drawx - oldDrawx;
  const movementDy = enemyTank.drawy - oldDrawy;
  const movementMagnitude = Math.hypot(movementDx, movementDy);
  if (movementMagnitude >= 0.001) {
    const angle = Math.round((Math.atan2(movementDy, movementDx) * 180) / Math.PI) % 360;
    enemyTank.angle = angle < 0 ? angle + 360 : angle;
  }
}

function calculateEnemyCurve(enemyTank: EnemyTank): void {
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

  enemyTank.drawx =
    (1 - t) * (1 - t) * enemyTank.curveStartx + 2 * (1 - t) * t * enemyTank.bezierx + t * t * enemyTank.curveEndx;
  enemyTank.drawy =
    (1 - t) * (1 - t) * enemyTank.curveStarty + 2 * (1 - t) * t * enemyTank.beziery + t * t * enemyTank.curveEndy;

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
    }
  }
}

function moveEnemyTowardsRoute(enemyTank: EnemyTank): void {
  let remainingStep = enemyTank.speed * delta;

  while (remainingStep > 0 && !enemyTank.docurve && enemyTank.lives > 0) {
    if (enemyTank.routeindex < 0 || enemyTank.routeindex >= LEVEL_ONE_ROUTE.length) {
      return;
    }

    const target = LEVEL_ONE_ROUTE[enemyTank.routeindex];
    const dx = target.drawx - enemyTank.drawx;
    const dy = target.drawy - enemyTank.drawy;
    const distance = Math.hypot(dx, dy);

    if (distance <= remainingStep) {
      enemyTank.drawx = target.drawx;
      enemyTank.drawy = target.drawy;
      remainingStep -= distance;

      if (enemyTank.routeindex === 0) {
        enemyTank.escaped = true;
        enemyTank.lives = 0;
        return;
      }

      enemyTank.routeindex -= 1;

      if (enemyTank.routeindex - 1 >= 0 && enemyTank.routeindex + 1 < LEVEL_ONE_ROUTE.length) {
        const previous = LEVEL_ONE_ROUTE[enemyTank.routeindex - 1];
        const current = LEVEL_ONE_ROUTE[enemyTank.routeindex];
        const next = LEVEL_ONE_ROUTE[enemyTank.routeindex + 1];
        const v1x = current.x - next.x;
        const v1y = current.y - next.y;
        const v2x = previous.x - current.x;
        const v2y = previous.y - current.y;
        const len1 = Math.hypot(v1x, v1y);
        const len2 = Math.hypot(v2x, v2y);

        if (len1 > 0 && len2 > 0) {
          const cross = (v1x / len1) * (v2y / len2) - (v1y / len1) * (v2x / len2);
          if (Math.abs(cross) > 0.05) {
            enemyTank.docurve = true;
            enemyTank.t = 0;
            enemyTank.curveStartx = next.drawx;
            enemyTank.curveStarty = next.drawy;
            enemyTank.curveEndx = previous.drawx;
            enemyTank.curveEndy = previous.drawy;
            enemyTank.bezierx = current.drawx;
            enemyTank.beziery = current.drawy;
          }
        }
      }

      continue;
    }

    enemyTank.drawx += (dx / distance) * remainingStep;
    enemyTank.drawy += (dy / distance) * remainingStep;
    remainingStep = 0;
  }
}

function calculateWeapons(state: SimulationState): void {
  for (const weapon of state.weapons) {
    const cell = getCellAt(weapon.gridX, weapon.gridY);
    weapon.startx = cell.drawx;
    weapon.starty = cell.drawy;

    if (weapon.type === WeaponType.RocketLauncher || weapon.type === WeaponType.MultiRocketLauncher) {
      weapon.angle += 35 * delta;
      if (weapon.angle > 359) {
        weapon.angle = 0;
      }

      const canons = (weapon as Weapon & { canons?: number[] }).canons;
      if (canons) {
        for (let i = 0; i < canons.length; i++) {
          canons[i] = (canons[i] + 1) % 360;
        }
      }
    }

    if (weapon.type === WeaponType.GrenadeThrower) {
      weapon.angle += 30 * delta;
      if (weapon.angle > 359) {
        weapon.angle = 0;
      }
    }

    if (weapon.type === WeaponType.GrenadeThrower) {
      weapon.lastFired += delta * 1000;
      if (weapon.lastFired > weapon.speed) {
        shootGrenade(state, weapon);
        weapon.lastFired = 0;
      }
      continue;
    }

    if (weapon.type === WeaponType.ChainLightningTower) {
      weapon.angle = 0;
      findClosestTarget(state, weapon);

      if (weapon.focusedIndex !== -1 && !isInRange(state, weapon, weapon.focusedIndex)) {
        weapon.focusedIndex = -1;
      }

      if (weapon.focusedIndex === -1) {
        continue;
      }

      weapon.locked = true;
      weapon.lastFired += delta * 1000;
      if (weapon.lastFired > weapon.speed) {
        shootWeapon(state, weapon);
        weapon.lastFired = 0;
      }
      continue;
    }

    if (weapon.type === WeaponType.LaserTurret && weapon.lastFired <= weapon.speed) {
      weapon.lastFired += delta * 1000;
      continue;
    }

    findClosestTarget(state, weapon);

    if (weapon.focusedIndex !== -1 && !isInRange(state, weapon, weapon.focusedIndex)) {
      weapon.focusedIndex = -1;
      weapon.locked = false;
    }

    if (weapon.focusedIndex === -1) {
      continue;
    }

    const enemy = state.enemies[weapon.focusedIndex];
    const centerEnemyX = enemy.drawx + 25;
    const centerEnemyY = enemy.drawy + 25;
    const turretCenterX = weapon.startx + 25;
    const turretCenterY = weapon.starty + 25;
    const deltaX = turretCenterX - centerEnemyX;
    const deltaY = turretCenterY - centerEnemyY;
    const rad = Math.atan2(deltaY, deltaX);
    const angleDest = Math.round((rad * 180) / Math.PI + 180);

    if (!weapon.locked) {
      let diff = angleDest - weapon.angle;
      if (diff < 0) {
        diff += 360;
      }

      if (diff > 180) {
        weapon.angle += -(150 * delta);
        if (weapon.angle < 0) {
          weapon.angle = 359;
        }
      } else {
        weapon.angle += 150 * delta;
        if (weapon.angle > 359) {
          weapon.angle = 0;
        }
      }
    } else {
      weapon.angle = angleDest;
      if (weapon.angle > 359) {
        weapon.angle = 0;
      }
      if (weapon.angle < 0) {
        weapon.angle = 359;
      }
    }

    if (Math.abs(angleDest - weapon.angle) < 5) {
      weapon.locked = true;
    }

    if (!weapon.locked) {
      continue;
    }

    weapon.lastFired += delta * 1000;
    if (weapon.focusedIndex !== -1 && weapon.lastFired > weapon.speed) {
      shootWeapon(state, weapon);
      weapon.lastFired = 0;
    }
  }
}

function shootWeapon(state: SimulationState, weapon: Weapon): void {
  switch (weapon.type) {
    case WeaponType.BulletShooter:
    case WeaponType.SlowRocketLauncher:
    case WeaponType.NuclearLauncher:
      state.projectiles.push(createBulletProjectile(state, weapon, weapon.focusedIndex));
      return;
    case WeaponType.FlameThrower:
      state.projectiles.push(...createFlameBubbleProjectiles(state, weapon));
      return;
    case WeaponType.RocketLauncher:
      state.projectiles.push(createRocketProjectile(state, weapon, weapon.focusedIndex));
      return;
    case WeaponType.MultiRocketLauncher:
      state.projectiles.push(createMultiRocketProjectile(state, weapon, weapon.focusedIndex));
      return;
    case WeaponType.ChainLightningTower:
      state.projectiles.push(createChainLightningProjectile(state, weapon, weapon.focusedIndex));
      return;
    case WeaponType.LaserTurret:
      state.projectiles.push(createLaserProjectile(state, weapon, weapon.focusedIndex));
      return;
    default:
      return;
  }
}

function shootGrenade(state: SimulationState, weapon: Weapon): void {
  const towerCenterX = weapon.gridX * 50 + 25;
  const towerCenterY = weapon.gridY * 50 + 25;
  const inRangePathCells = LEVEL_ONE_ROUTE.filter(routeCell => Math.hypot(routeCell.drawx + 25 - towerCenterX, routeCell.drawy + 25 - towerCenterY) <= weapon.range);
  if (inRangePathCells.length === 0) {
    return;
  }

  const activeMines = state.projectiles.filter(
    (projectile): projectile is Grenade =>
      projectile.type === ProjectileType.GrenadeMine && projectile.needdraw && (projectile.isArmed || projectile.speed > 0)
  );

  const freeCells = inRangePathCells.filter(routeCell => {
    const routeCenterX = routeCell.drawx + 25;
    const routeCenterY = routeCell.drawy + 25;
    return !activeMines.some(mine => Math.hypot(mine.targetX - routeCenterX, mine.targetY - routeCenterY) < 35);
  });

  const targetCells = freeCells.length > 0 ? freeCells : inRangePathCells;
  const randomCell = targetCells[state.random.nextInt(targetCells.length)];
  state.projectiles.push({
    type: ProjectileType.GrenadeMine,
    gridX: -1,
    gridY: -1,
    x: towerCenterX,
    y: towerCenterY,
    enemyIndex: -1,
    needdraw: true,
    damage: weapon.damage,
    damageType: getDamageTypeForWeaponType(weapon.type),
    angle: 0,
    speed: 250,
    targetX: randomCell.drawx + 25,
    targetY: randomCell.drawy + 25,
    isArmed: false,
    blinkTimerMs: 150,
    blastRadius: 45,
    triggerRadius: 22,
    lifeTimeMs: 8000,
  });
}

function createBulletProjectile(state: SimulationState, weapon: Weapon, enemyIndex: number): Projectile {
  const enemy = state.enemies[enemyIndex];
  const turretCenterX = weapon.gridX * 50 + 25;
  const turretCenterY = weapon.gridY * 50 + 25;
  const enemyCenterX = enemy.drawx + 25;
  const enemyCenterY = enemy.drawy + 25;
  const rad = Math.atan2(turretCenterY - enemyCenterY, turretCenterX - enemyCenterX);
  const projectileSpeed = getProjectileSpeed(state.balance, weapon.type);
  const projectileType = getProjectileType(state.balance, weapon.type);

  if (
    projectileType !== ProjectileType.Bullet &&
    projectileType !== ProjectileType.SlowRocket &&
    projectileType !== ProjectileType.NuclearBullet
  ) {
    throw new Error('Invalid bullet projectile');
  }

  return {
    type: projectileType,
    gridX: weapon.gridX,
    gridY: weapon.gridY,
    x: turretCenterX - 25 * Math.cos(rad),
    y: turretCenterY - 25 * Math.sin(rad),
    enemyIndex,
    needdraw: true,
    damage: weapon.damage,
    damageType: getDamageTypeForWeaponType(weapon.type),
    angle: null,
    speed: projectileSpeed,
  };
}

function createRocketProjectile(state: SimulationState, weapon: Weapon, enemyIndex: number): Rocket {
  const canons = (weapon as Weapon & { canons?: number[] }).canons;
  const angle = canons ? canons[state.random.nextInt(canons.length)] : state.random.nextInt(4) * 90;
  const centerX = weapon.gridX * 50 + 25;
  const centerY = weapon.gridY * 50 + 25;
  return {
    type: ProjectileType.Rocket,
    gridX: weapon.gridX,
    gridY: weapon.gridY,
    x: centerX + 20 * Math.cos((angle * Math.PI) / 180),
    y: centerY + 20 * Math.sin((angle * Math.PI) / 180),
    enemyIndex,
    angle,
    locked: false,
    needdraw: true,
    damage: weapon.damage,
    damageType: getDamageTypeForWeaponType(weapon.type),
    plusrotation: null,
    steps: 0,
    speed: getProjectileSpeed(state.balance, weapon.type),
    isChild: false,
    hasSplit: true,
    splitDelayRemainingMs: null,
    childRocketCount: 0,
    childSearchRadius: 0,
    childDamageMultiplier: 1,
    childSpeedMultiplier: 1,
  };
}

function createMultiRocketProjectile(state: SimulationState, weapon: Weapon, enemyIndex: number): Rocket {
  const rocket = createRocketProjectile(state, weapon, enemyIndex);
  const splitRocket = getSplitRocketConfig(state.balance, weapon.type);
  return {
    ...rocket,
    splitDelayRemainingMs: splitRocket.splitDelayMs,
    hasSplit: false,
    childRocketCount: splitRocket.childRocketCount,
    childSearchRadius: splitRocket.childSearchRadius,
    childDamageMultiplier: splitRocket.childDamageMultiplier,
    childSpeedMultiplier: splitRocket.childSpeedMultiplier,
  };
}

function createLaserProjectile(_state: SimulationState, weapon: Weapon, enemyIndex: number): Laser {
  const enemy = _state.enemies[enemyIndex];
  const turretCenterX = weapon.gridX * 50 + 25;
  const turretCenterY = weapon.gridY * 50 + 25;
  const enemyCenterX = enemy.drawx + 25;
  const enemyCenterY = enemy.drawy + 25;
  const rad = Math.atan2(turretCenterY - enemyCenterY, turretCenterX - enemyCenterX);

  return {
    duration: 10,
    type: ProjectileType.Laser,
    gridX: weapon.gridX,
    gridY: weapon.gridY,
    x: turretCenterX - 25 * Math.cos(rad),
    y: turretCenterY - 25 * Math.sin(rad),
    enemyIndex,
    needdraw: true,
    damage: weapon.damage,
    damageType: getDamageTypeForWeaponType(weapon.type),
    angle: null,
    laserParts: [],
  };
}

function createChainLightningProjectile(state: SimulationState, weapon: Weapon, enemyIndex: number): ChainLightning {
  const chainLightning = getChainLightningConfig(state.balance, weapon.type);
  const sourceX = weapon.gridX * 50 + 25;
  const sourceY = weapon.gridY * 50 + 25;
  const hits = resolveChainLightningShot(state.enemies, sourceX, sourceY, enemyIndex, chainLightning);

  return {
    type: ProjectileType.ChainLightning,
    gridX: weapon.gridX,
    gridY: weapon.gridY,
    x: sourceX,
    y: sourceY,
    enemyIndex,
    needdraw: hits.length > 0,
    damage: weapon.damage,
    damageType: getDamageTypeForWeaponType(weapon.type),
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

function createFlameBubbleProjectiles(state: SimulationState, weapon: Weapon): FlameBubble[] {
  const flameBubbleConfig = getFlameBubbleConfig(state.balance, weapon.type);
  const centerX = weapon.gridX * 50 + 25;
  const centerY = weapon.gridY * 50 + 25;
  const angles = getFlameBubbleAngles(weapon.angle, flameBubbleConfig.bubblesPerShot, flameBubbleConfig.spreadDegrees);

  return angles.map(angle => {
    const radians = (angle * Math.PI) / 180;
    return {
      type: ProjectileType.FlameBubble,
      gridX: weapon.gridX,
      gridY: weapon.gridY,
      x: centerX + Math.cos(radians) * 18,
      y: centerY + Math.sin(radians) * 18,
      needdraw: true,
      damage: weapon.damage,
      damageType: getDamageTypeForWeaponType(weapon.type),
      angle,
      speed: getProjectileSpeed(state.balance, weapon.type),
      remainingMs: flameBubbleConfig.lifetimeMs,
      hitRadius: flameBubbleConfig.hitRadius,
      scale: flameBubbleConfig.visualScale,
      hitEnemyIndexes: [],
    };
  });
}

function calculateProjectiles(state: SimulationState): void {
  for (const projectile of state.projectiles) {
    if (projectile.type === ProjectileType.Rocket) {
      calculateRocket(state, projectile);
      continue;
    }

    if (
      projectile.type === ProjectileType.Bullet ||
      projectile.type === ProjectileType.SlowRocket ||
      projectile.type === ProjectileType.NuclearBullet
    ) {
      calculateBullet(state, projectile);
      continue;
    }

    if (projectile.type === ProjectileType.Laser) {
      calculateLaser(state, projectile);
      continue;
    }

    if (projectile.type === ProjectileType.FlameBubble) {
      calculateFlameBubble(state, projectile);
      continue;
    }

    if (projectile.type === ProjectileType.ChainLightning) {
      calculateChainLightning(state, projectile);
      continue;
    }

    calculateGrenade(state, projectile as Grenade);
  }

  state.projectiles = state.projectiles.filter(projectile => projectile.needdraw);
}

function calculateBullet(state: SimulationState, bullet: Extract<Projectile, { type: ProjectileType.Bullet | ProjectileType.SlowRocket | ProjectileType.NuclearBullet }>): void {
  if (!bullet.needdraw) {
    return;
  }

  const enemy = state.enemies[bullet.enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    bullet.needdraw = false;
    return;
  }

  const centerEnemyX = enemy.drawx + 25;
  const centerEnemyY = enemy.drawy + 25;
  const deltaX = bullet.x - centerEnemyX;
  const deltaY = bullet.y - centerEnemyY;
  const rad = Math.atan2(deltaY, deltaX);
  bullet.angle = Math.round((rad * 180) / Math.PI + 180);
  if (bullet.angle === 360) {
    bullet.angle = 359;
  }

  bullet.x = bullet.x - bullet.speed * delta * Math.cos(rad);
  bullet.y = bullet.y - bullet.speed * delta * Math.sin(rad);

  if (Math.abs(bullet.x - centerEnemyX) < 10 && Math.abs(bullet.y - centerEnemyY) < 10) {
    bullet.needdraw = false;
    applyDamage(state, bullet.enemyIndex, bullet.damage, bullet.damageType);
  }
}

function calculateRocket(state: SimulationState, rocket: Rocket): void {
  if (!rocket.needdraw) {
    return;
  }

  const enemy = state.enemies[rocket.enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    rocket.needdraw = false;
    return;
  }

  const centerEnemyX = enemy.drawx + 25;
  const centerEnemyY = enemy.drawy + 25;
  const deltaX = rocket.x - centerEnemyX;
  const deltaY = rocket.y - centerEnemyY;
  const targetAngle = Math.round((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 180);

  if (!rocket.locked) {
    if (rocket.plusrotation === null) {
      const clockwiseSteps = (targetAngle - rocket.angle + 360) % 360;
      const counterClockwiseSteps = (rocket.angle - targetAngle + 360) % 360;
      rocket.plusrotation = clockwiseSteps <= counterClockwiseSteps;
    }

    if (++rocket.steps > 359) {
      rocket.plusrotation = !rocket.plusrotation;
      rocket.steps = 0;
    }

    const rotationSpeed = 175 * delta;
    rocket.angle += rocket.plusrotation ? rotationSpeed : -rotationSpeed;
    if (Math.abs(targetAngle - rocket.angle) < 5) {
      rocket.locked = true;
    }
  } else {
    rocket.angle = targetAngle;
  }

  rocket.angle = (rocket.angle + 360) % 360;
  const speed = rocket.locked ? rocket.speed * 2 : rocket.speed;
  const radians = (rocket.angle * Math.PI) / 180;
  rocket.x += delta * speed * Math.cos(radians);
  rocket.y += delta * speed * Math.sin(radians);

  const splitChildren = splitRocketIfReady(state, rocket);
  if (splitChildren.length > 0) {
    rocket.hasSplit = true;
    rocket.needdraw = false;
    state.projectiles.push(...splitChildren);
    return;
  }

  if (Math.abs(rocket.x - centerEnemyX) < 10 && Math.abs(rocket.y - centerEnemyY) < 10) {
    rocket.needdraw = false;
    applyDamage(state, rocket.enemyIndex, rocket.damage, rocket.damageType);
  }
}

function splitRocketIfReady(state: SimulationState, rocket: Rocket): Rocket[] {
  if (rocket.isChild || rocket.hasSplit || rocket.splitDelayRemainingMs === null) {
    return [];
  }

  const enemy = state.enemies[rocket.enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    rocket.hasSplit = true;
    return [];
  }

  rocket.splitDelayRemainingMs -= delta * 1000;
  const distanceToPrimary = Math.hypot(enemy.drawx + 25 - rocket.x, enemy.drawy + 25 - rocket.y);
  const shouldSplit = rocket.splitDelayRemainingMs <= 0 || distanceToPrimary <= Math.max(60, rocket.childSearchRadius * 0.55);
  if (!shouldSplit) {
    return [];
  }

  const targetIndexes = selectSplitRocketTargets(state.enemies, rocket.x, rocket.y, rocket.enemyIndex, {
    childRocketCount: rocket.childRocketCount,
    childSearchRadius: rocket.childSearchRadius,
  });

  return targetIndexes.map((enemyIndex, childIndex) => ({
    ...rocket,
    enemyIndex,
    angle: (rocket.angle + (childIndex - (targetIndexes.length - 1) / 2) * 26 + 360) % 360,
    locked: false,
    plusrotation: null,
    steps: 0,
    damage: rocket.damage * rocket.childDamageMultiplier,
    speed: rocket.speed * rocket.childSpeedMultiplier,
    isChild: true,
    hasSplit: true,
    splitDelayRemainingMs: null,
  }));
}

function calculateLaser(state: SimulationState, laser: Laser): void {
  const enemy = state.enemies[laser.enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    laser.needdraw = false;
    return;
  }

  laser.duration--;
  if (laser.duration <= 0) {
    laser.needdraw = false;
  }

  applyDamage(state, laser.enemyIndex, laser.damage, laser.damageType);
}

function calculateFlameBubble(state: SimulationState, flameBubble: FlameBubble): void {
  if (!flameBubble.needdraw) {
    return;
  }

  const radians = (flameBubble.angle * Math.PI) / 180;
  flameBubble.x += Math.cos(radians) * flameBubble.speed * delta;
  flameBubble.y += Math.sin(radians) * flameBubble.speed * delta;
  flameBubble.remainingMs -= delta * 1000;

  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex++) {
    if (flameBubble.hitEnemyIndexes.includes(enemyIndex)) {
      continue;
    }

    const enemy = state.enemies[enemyIndex];
    if (!enemy || enemy.lives <= 0) {
      continue;
    }

    const distance = Math.hypot(enemy.drawx + 25 - flameBubble.x, enemy.drawy + 25 - flameBubble.y);
    if (distance <= flameBubble.hitRadius + 18) {
      flameBubble.hitEnemyIndexes.push(enemyIndex);
      applyDamage(state, enemyIndex, flameBubble.damage, flameBubble.damageType);
    }
  }

  if (flameBubble.remainingMs <= 0) {
    flameBubble.needdraw = false;
  }
}

function calculateChainLightning(state: SimulationState, chainLightning: ChainLightning): void {
  if (!chainLightning.applied) {
    chainLightning.applied = true;
    for (const hit of chainLightning.hits) {
      applyDamage(state, hit.enemyIndex, chainLightning.damage * hit.damageMultiplier, chainLightning.damageType);
    }
  }

  chainLightning.duration--;
  if (chainLightning.duration <= 0) {
    chainLightning.needdraw = false;
  }
}

function calculateGrenade(state: SimulationState, grenade: Grenade): void {
  if (!grenade.isArmed) {
    const remainingX = grenade.targetX - grenade.x;
    const remainingY = grenade.targetY - grenade.y;
    const distance = Math.hypot(remainingX, remainingY);
    const step = grenade.speed * delta;

    if (distance <= step) {
      grenade.x = grenade.targetX;
      grenade.y = grenade.targetY;
      grenade.isArmed = true;
      grenade.angle = 0;
    } else {
      grenade.x += (remainingX / distance) * step;
      grenade.y += (remainingY / distance) * step;
    }

    return;
  }

  grenade.blinkTimerMs -= delta * 1000;
  if (grenade.blinkTimerMs <= 0) {
    grenade.angle = grenade.angle === 0 ? 1 : 0;
    grenade.blinkTimerMs = 150;
  }

  grenade.lifeTimeMs -= delta * 1000;
  if (grenade.lifeTimeMs <= 0) {
    grenade.needdraw = false;
    return;
  }

  let shouldExplode = false;
  for (const enemy of state.enemies) {
    if (enemy.lives <= 0) {
      continue;
    }

    const distance = Math.hypot(enemy.drawx + 25 - grenade.x, enemy.drawy + 25 - grenade.y);
    if (distance <= grenade.triggerRadius) {
      shouldExplode = true;
      break;
    }
  }

  if (!shouldExplode) {
    return;
  }

  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex++) {
    const enemy = state.enemies[enemyIndex];
    if (enemy.lives <= 0) {
      continue;
    }
    const distance = Math.hypot(enemy.drawx + 25 - grenade.x, enemy.drawy + 25 - grenade.y);
    if (distance <= grenade.blastRadius) {
      applyDamage(state, enemyIndex, grenade.damage, grenade.damageType);
    }
  }

  grenade.needdraw = false;
}

function applyDamage(state: SimulationState, enemyIndex: number, rawDamage: number, damageType: DamageType): void {
  const enemy = state.enemies[enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    return;
  }

  const multiplier = (state.balance.damageMultipliers[damageType][enemy.armorClass] ?? 1) * 1.4;
  const damage = rawDamage * multiplier;
  const previous = enemy.lives;
  enemy.lives = Math.max(0, enemy.lives - damage);
  state.damageByType[damageType] = (state.damageByType[damageType] ?? 0) + Math.max(0, previous - enemy.lives);
}

function applyPolicy(state: SimulationState, policy: SimulationPolicy): void {
  const attempts = isPlanningWindow(state) ? 3 : 1;
  const actions = getPolicyActions(
    {
      balance: state.balance,
      money: state.economy.money,
      waveNumber: state.wave.waveNumber,
      phase: state.wave.phase,
      weapons: state.weapons,
    },
    policy,
    attempts
  );

  for (const action of actions) {
    if (action.kind === 'build') {
      const weapon = createWeaponFromTowerConfig(state.balance, action.towerType, action.x, action.y, 1, 1, 1, state.random);
      state.weapons.push(weapon);
      state.economy.money -= action.cost;
      state.economy.moneySpent += action.cost;
      state.towerBuildCounts[action.towerType] = (state.towerBuildCounts[action.towerType] ?? 0) + 1;
      state.buildTimeline.push({ wave: state.wave.waveNumber, type: action.towerType, x: action.x, y: action.y });
      continue;
    }

    const weapon = state.weapons[action.weaponIndex];
    if (!weapon) {
      continue;
    }

    applyWeaponUpgradeLevel(weapon, action.upgradeType, action.targetLevel);
    applyWeaponStats(state.balance, weapon);
    state.economy.money -= action.cost;
    state.economy.moneySpent += action.cost;
    state.towerUpgradeCounts[weapon.type] = (state.towerUpgradeCounts[weapon.type] ?? 0) + 1;
  }
}

function isPlanningWindow(state: SimulationState): boolean {
  return state.wave.phase === 'waiting' || state.wave.timeUntilNextWaveMs > 0;
}

function scoreSimulation(state: SimulationState, policy: SimulationPolicy, averageSpendRatio: number, maxWave: number): SimulationScoreBreakdown {
  const finalWave = Math.max(1, state.wave.nextWaveNumber - 1);
  const targetWave = getTargetChallengeWave(maxWave);
  const belowTargetPenalty = Math.max(0, targetWave - finalWave) * 5.4;
  const aboveTargetPenalty = Math.max(0, finalWave - targetWave) * 3.2;
  const overrunPenalty = Math.max(0, finalWave - (targetWave + 8)) * 2.4;
  const challenge = Math.max(0, 98 - belowTargetPenalty - aboveTargetPenalty - overrunPenalty);
  const spendPressure = Math.max(0, Math.min(20, averageSpendRatio * 24));
  const towerTypesUsed = Object.keys(state.towerBuildCounts).length;
  const diversity = Math.min(12, towerTypesUsed * 2.5 + Object.keys(state.towerUpgradeCounts).length * 0.4);
  const hoardRatio = state.economy.moneySpent / Math.max(1, state.economy.moneySpent + state.economy.money);
  const antiHoarding =
    policy.name === 'hoarder'
      ? Math.max(-40, -8 - finalWave * 1.8 - (1 - hoardRatio) * 12 - Math.max(0, state.economy.moneyHoardedPeak - 100) / 10)
      : Math.max(0, 8 - Math.max(0, state.economy.moneyHoardedPeak - 120) / 20);
  const stability = state.economy.baseHealth > 0 ? Math.min(8, state.economy.baseHealth * 0.35) : -8;
  const total = challenge + spendPressure + diversity + antiHoarding + stability;

  return {
    challenge,
    spendPressure,
    diversity,
    antiHoarding,
    stability,
    total,
  };
}


function createWeaponFromTowerConfig(
  balance: BalanceConfig,
  type: WeaponType,
  x: number,
  y: number,
  speedLevel: number,
  powerLevel: number,
  rangeLevel: number,
  random: RandomSource
): Weapon {
  const weapon: Weapon = {
    type,
    rangeLevel,
    powerLevel,
    speedLevel,
    damage: 0,
    speed: 0,
    range: 0,
    gridX: x,
    gridY: y,
    focusedIndex: -1,
    focusedIndexes: [],
    locked: false,
    startx: null,
    starty: null,
    lastFired: 99999,
    angle: random.nextInt(360),
  };

  if (type === WeaponType.RocketLauncher) {
    (weapon as Weapon & { canons: number[] }).canons = [0, 90, 180, 270];
  }

  if (type === WeaponType.MultiRocketLauncher) {
    (weapon as Weapon & { canons: number[] }).canons = [45, 135, 225, 315];
  }

  if (type === WeaponType.ChainLightningTower) {
    weapon.angle = 0;
  }

  if (type === WeaponType.LaserTurret) {
    (weapon as Weapon & { duration: number }).duration = 1000;
  }

  applyWeaponStats(balance, weapon);
  return weapon;
}

function applyWeaponStats(balance: BalanceConfig, weapon: Weapon): void {
  const towerConfig = balance.towers.find(tower => tower.type === weapon.type);
  if (!towerConfig) {
    return;
  }

  weapon.damage = getUpgradeLevelValue(towerConfig.upgrades, UpgradeType.Damage, weapon.powerLevel);
  weapon.range = getUpgradeLevelValue(towerConfig.upgrades, UpgradeType.Range, weapon.rangeLevel);
  weapon.speed = getUpgradeLevelValue(towerConfig.upgrades, UpgradeType.Speed, weapon.speedLevel);
}

function getUpgradeLevelValue(upgrades: UpgradeDetails[], type: UpgradeType, level: number): number {
  const upgrade = upgrades.find(entry => entry.type === type);
  const detail = upgrade?.details.find(entry => entry.level === level);
  if (!detail) {
    throw new Error(`Missing upgrade detail for ${type} level ${level}`);
  }
  return detail.value;
}

function findClosestTarget(state: SimulationState, weapon: Weapon): void {
  if (weapon.focusedIndex !== -1) {
    return;
  }

  let shortestRoute = -1;
  let shortestIndex = -1;

  for (let index = 0; index < state.enemies.length; index++) {
    if (isInRange(state, weapon, index)) {
      if (shortestIndex === -1 || state.enemies[index].routeindex > shortestRoute) {
        shortestRoute = state.enemies[index].routeindex;
        shortestIndex = index;
      }
    }
  }

  if (shortestIndex !== -1) {
    weapon.focusedIndex = shortestIndex;
  }
}

function isInRange(state: SimulationState, weapon: Weapon, enemyIndex: number): boolean {
  const enemy = state.enemies[enemyIndex];
  if (!enemy || enemy.lives <= 0) {
    return false;
  }
  return Math.hypot(enemy.drawx + 25 - (weapon.gridX * 50 + 25), enemy.drawy + 25 - (weapon.gridY * 50 + 25)) < weapon.range;
}

function getCellAt(x: number, y: number): Cell {
  return {
    x,
    y,
    drawx: x * 50,
    drawy: y * 50,
    width: 50,
    height: 50,
    imageIndex: null,
    steps: 0,
    done: false,
    parentcell: null,
    placeHolder: null,
    cellcolor: 'grey',
  };
}

function getProjectileType(balance: BalanceConfig, type: WeaponType): ProjectileType {
  const towerConfig = balance.towers.find(tower => tower.type === type);
  if (!towerConfig) {
    throw new Error(`Missing tower config for ${type}`);
  }
  return towerConfig.projectileType;
}

function getProjectileSpeed(balance: BalanceConfig, type: WeaponType): number {
  const towerConfig = balance.towers.find(tower => tower.type === type);
  if (!towerConfig || towerConfig.projectileSpeed === null) {
    throw new Error(`Missing projectile speed for ${type}`);
  }
  return towerConfig.projectileSpeed;
}

function getChainLightningConfig(balance: BalanceConfig, type: WeaponType) {
  const towerConfig = balance.towers.find(tower => tower.type === type);
  if (!towerConfig?.chainLightning) {
    throw new Error(`Missing chain lightning config for ${type}`);
  }
  return towerConfig.chainLightning;
}

function getFlameBubbleConfig(balance: BalanceConfig, type: WeaponType): FlameBubbleConfig {
  const towerConfig = balance.towers.find(tower => tower.type === type);
  if (!towerConfig?.flameBubble) {
    throw new Error(`Missing flame bubble config for ${type}`);
  }
  return towerConfig.flameBubble;
}

function getSplitRocketConfig(balance: BalanceConfig, type: WeaponType): SplitRocketConfig {
  const towerConfig = balance.towers.find(tower => tower.type === type);
  if (!towerConfig?.splitRocket) {
    throw new Error(`Missing split rocket config for ${type}`);
  }
  return towerConfig.splitRocket;
}

function getEnemyTypeForEnemyStats(enemyConfigs: EnemyConfig[], enemy: EnemyTank): EnemyType | null {
  const match = enemyConfigs.find(
    config => config.health === enemy.maxLives && config.reward === enemy.reward && config.armorClass === enemy.armorClass
  );
  return match?.type ?? null;
}

export function mutateBalanceConfig(balance: BalanceConfig, random: RandomSource): BalanceConfig {
  const mutated: BalanceConfig = JSON.parse(JSON.stringify(balance)) as BalanceConfig;

  for (const tower of mutated.towers) {
    tower.cost = clampNumber(mutateNumber(tower.cost, 0.15, random), 12, 120, true);
    if (tower.chainLightning) {
      tower.chainLightning.chainCount = clampNumber(mutateNumber(tower.chainLightning.chainCount, 0.2, random), 1, 5, true);
      tower.chainLightning.chainRadius = clampNumber(mutateNumber(tower.chainLightning.chainRadius, 0.16, random), 45, 140, true);
      tower.chainLightning.damageFalloff = clampNumber(mutateNumber(tower.chainLightning.damageFalloff, 0.12, random), 0.45, 0.9);
      tower.chainLightning.durationTicks = clampNumber(mutateNumber(tower.chainLightning.durationTicks, 0.12, random), 3, 10, true);
    }
    if (tower.flameBubble) {
      tower.flameBubble.lifetimeMs = clampNumber(mutateNumber(tower.flameBubble.lifetimeMs, 0.14, random), 180, 650, true);
      tower.flameBubble.hitRadius = clampNumber(mutateNumber(tower.flameBubble.hitRadius, 0.14, random), 8, 22, true);
      tower.flameBubble.visualScale = clampNumber(mutateNumber(tower.flameBubble.visualScale, 0.08, random), 0.7, 1.4);
      tower.flameBubble.bubblesPerShot = clampNumber(mutateNumber(tower.flameBubble.bubblesPerShot, 0.16, random), 1, 5, true);
      tower.flameBubble.spreadDegrees = clampNumber(mutateNumber(tower.flameBubble.spreadDegrees, 0.16, random), 4, 28, true);
    }
    if (tower.splitRocket) {
      tower.splitRocket.splitDelayMs = clampNumber(mutateNumber(tower.splitRocket.splitDelayMs, 0.14, random), 120, 520, true);
      tower.splitRocket.childRocketCount = clampNumber(mutateNumber(tower.splitRocket.childRocketCount, 0.15, random), 1, 5, true);
      tower.splitRocket.childSearchRadius = clampNumber(mutateNumber(tower.splitRocket.childSearchRadius, 0.16, random), 60, 200, true);
      tower.splitRocket.childDamageMultiplier = clampNumber(mutateNumber(tower.splitRocket.childDamageMultiplier, 0.14, random), 0.3, 0.9);
      tower.splitRocket.childSpeedMultiplier = clampNumber(mutateNumber(tower.splitRocket.childSpeedMultiplier, 0.12, random), 0.8, 1.6);
    }
    for (const upgrade of tower.upgrades) {
      for (const detail of upgrade.details) {
        detail.cost = clampNumber(mutateNumber(detail.cost, 0.18, random), 4, 110, true);
        detail.value = clampUpgradeValue(upgrade.type, mutateNumber(detail.value, 0.12, random));
      }
      normalizeUpgradeProgression(upgrade);
    }
  }

  for (const enemy of mutated.enemies) {
    enemy.health = clampNumber(mutateNumber(enemy.health, 0.2, random), 6, 250, true);
    enemy.speed = clampNumber(mutateNumber(enemy.speed, 0.15, random), 70, 240, true);
    enemy.reward = clampNumber(mutateNumber(enemy.reward, 0.18, random), 6, 150, true);
    enemy.threat = clampNumber(mutateNumber(enemy.threat, 0.18, random), 0.8, 20);
    enemy.weight = clampNumber(mutateNumber(enemy.weight, 0.2, random), 0.15, 2.5);
    enemy.unlockWave = clampNumber(mutateNumber(enemy.unlockWave, 0.15, random), 1, 25, true);
    enemy.baseDamageToBase = clampNumber(mutateNumber(enemy.baseDamageToBase, 0.15, random), 1, 5, true);
  }

  mutated.waves.initialWaveCountdownMs = clampNumber(mutateNumber(mutated.waves.initialWaveCountdownMs, 0.12, random), 5000, 20000, true);
  mutated.waves.waveDurationMs = clampNumber(mutateNumber(mutated.waves.waveDurationMs, 0.1, random), 18000, 45000, true);
  mutated.waves.budgetBase = clampNumber(mutateNumber(mutated.waves.budgetBase, 0.12, random), 1.5, 8);
  mutated.waves.budgetGrowthLinear = clampNumber(mutateNumber(mutated.waves.budgetGrowthLinear, 0.14, random), 0.8, 4.5);
  mutated.waves.budgetGrowthPower = clampNumber(mutateNumber(mutated.waves.budgetGrowthPower, 0.08, random), 1.05, 1.45);
  mutated.waves.budgetGrowthFactor = clampNumber(mutateNumber(mutated.waves.budgetGrowthFactor, 0.15, random), 0.25, 1.5);
  mutated.waves.eliteWeightBoostPerWave = clampNumber(mutateNumber(mutated.waves.eliteWeightBoostPerWave, 0.18, random), 0.005, 0.05);
  mutated.waves.maxEnemiesPerWave = clampNumber(mutateNumber(mutated.waves.maxEnemiesPerWave, 0.1, random), 12, 80, true);

  return mutated;
}

function normalizeUpgradeProgression(upgrade: UpgradeDetails): void {
  let previousValue = upgrade.details[0]?.value ?? 0;
  let previousCost = 0;

  for (const detail of upgrade.details) {
    detail.cost = Math.max(previousCost + 1, detail.cost);

    if (upgrade.type === UpgradeType.Speed) {
      detail.value = Math.min(previousValue, detail.value);
      previousValue = detail.value;
    } else {
      detail.value = Math.max(previousValue, detail.value);
      previousValue = detail.value;
    }

    previousCost = detail.cost;
  }
}

function clampUpgradeValue(type: UpgradeType, value: number): number {
  if (type === UpgradeType.Speed) {
    return clampNumber(value, 500, 2200, true);
  }
  if (type === UpgradeType.Range) {
    return clampNumber(value, 80, 420, true);
  }
  return clampNumber(value, 1, 25);
}

function mutateNumber(value: number, range: number, random: RandomSource): number {
  const swing = (random.next() * 2 - 1) * range;
  return value * (1 + swing);
}

function clampNumber(value: number, min: number, max: number, integer = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  return integer ? Math.round(clamped) : Number(clamped.toFixed(4));
}

export function getBuildableCellCount(): number {
  return getLevelOneBuildableCells().length;
}

export function simulateSoloTowerProbe(balance: BalanceConfig, towerType: WeaponType, seed: number, maxWave = 12): SoloTowerProbeResult {
  const state = createInitialSimulationState(balance, seed);
  state.wave.maxWaveLimit = maxWave;
  const bestPlacement = getRankedPlacementCandidates()
    .map(candidate => ({
      ...candidate,
      score: calculatePlacementScore(candidate.x, candidate.y, towerType),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestPlacement) {
    throw new Error(`No buildable placement found for ${towerType}`);
  }

  const weapon = createWeaponFromTowerConfig(balance, towerType, bestPlacement.x, bestPlacement.y, 1, 1, 1, state.random);
  const towerCost = balance.towers.find(tower => tower.type === towerType)?.cost ?? 0;

  state.weapons.push(weapon);
  state.economy.money = Math.max(0, state.economy.money - towerCost);
  state.economy.moneySpent += towerCost;

  while (state.economy.baseHealth > 0 && state.wave.nextWaveNumber <= maxWave + 1) {
    tickSimulation(state);

    if (
      state.wave.nextWaveNumber > maxWave &&
      state.wave.activeWindows.length === 0 &&
      state.enemies.every(enemy => enemy.lives <= 0)
    ) {
      break;
    }
  }

  return {
    towerType,
    x: bestPlacement.x,
    y: bestPlacement.y,
    finalWave: Math.max(1, state.wave.nextWaveNumber - 1),
    baseHealthRemaining: state.economy.baseHealth,
  };
}
