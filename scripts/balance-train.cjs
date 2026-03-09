#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = process.cwd();

function loadTsModule(entryPath, cache = new Map()) {
  const resolvedPath = path.resolve(entryPath);
  if (cache.has(resolvedPath)) {
    return cache.get(resolvedPath).exports;
  }

  const source = fs.readFileSync(resolvedPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText;

  const module = { exports: {} };
  cache.set(resolvedPath, module);

  function localRequire(specifier) {
    if (specifier.startsWith('.')) {
      const hasKnownExt = ['.ts', '.js', '.mjs', '.cjs', '.json'].some(ext => specifier.endsWith(ext));
      const withExt = hasKnownExt ? specifier : `${specifier}.ts`;
      const nextPath = path.resolve(path.dirname(resolvedPath), withExt);
      return loadTsModule(nextPath, cache);
    }
    return require(specifier);
  }

  const wrapped = `(function (exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
  const fn = vm.runInThisContext(wrapped, { filename: resolvedPath });
  fn(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath));
  return module.exports;
}

function parseFixedRoute(gridServicePath) {
  const file = fs.readFileSync(gridServicePath, 'utf8');
  const marker = "const fixedRoute = JSON.parse(";
  const markerIndex = file.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Could not find fixedRoute in grid.service.ts');
  }

  const startQuote = file.indexOf("'", markerIndex);
  const endQuote = file.indexOf("'\n) as Cell[];", startQuote);
  if (startQuote < 0 || endQuote < 0) {
    throw new Error('Could not parse fixedRoute JSON string');
  }

  const jsonPayload = file.slice(startQuote + 1, endQuote);
  return JSON.parse(jsonPayload);
}

function computeRouteLength(route) {
  let length = 0;
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].drawx - route[i - 1].drawx;
    const dy = route[i].drawy - route[i - 1].drawy;
    length += Math.hypot(dx, dy);
  }
  return length;
}

function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function format(num, digits = 3) {
  return Number(num).toFixed(digits);
}

function getUpgradeDetail(config, type, level) {
  const upgrade = config.upgrades.find(item => item.type === type);
  if (!upgrade) {
    throw new Error(`Missing upgrade type '${type}' for ${config.type}`);
  }

  const detail = upgrade.details.find(item => item.level === level);
  if (!detail) {
    throw new Error(`Missing level ${level} for ${type} ${config.type}`);
  }

  return detail;
}

function getWaveDamageWeightByType(unlocked, weights, getDamageByEnemyType) {
  const sum = {};
  for (let i = 0; i < unlocked.length; i++) {
    const enemy = unlocked[i];
    const dmg = getDamageByEnemyType(enemy.type);
    sum.total = (sum.total ?? 0) + dmg * weights[i];
  }
  return (sum.total ?? 1);
}

function getBaseDamageByEnemyType(enemyType, enemyTypeEnum) {
  switch (enemyType) {
    case enemyTypeEnum.ScoutTank:
    case enemyTypeEnum.SiegeTank:
    case enemyTypeEnum.LightHovercraft:
    case enemyTypeEnum.HeavyHovercraft:
      return 2;
    case enemyTypeEnum.FighterPlane:
    case enemyTypeEnum.BomberPlane:
    case enemyTypeEnum.Boss:
      return 3;
    default:
      return 1;
  }
}

function getDefaultCandidate() {
  return {
    wave: {
      healthGrowth: 0.06,
      speedGrowth: 0.008,
      earlyHealthMultiplier: 0.62,
      earlySpeedMultiplier: 0.82,
      earlyWaves: 4,
      rewardGrowth: 0.06,
      countGrowth: 1.2,
      spawnBaseMs: 1400,
      spawnDecayMs: 30,
      spawnMinMs: 420,
    },
    economy: {
      startMoney: 100,
      reserveIntermissionBase: 16,
      reserveIntermissionPerWave: 3,
      reserveSpawningBase: 24,
      reserveSpawningPerWave: 4,
      reserveCleanupBase: 15,
      reserveCleanupPerWave: 2,
    },
    ai: {
      diversityPenalty: 0.45,
      compositionStrength: 2.25,
      upgradePreference: 0.9,
      rangeUtilityPerLevel: 0.03,
    },
    multipliers: {
      turretCostByType: {
        BulletShooter: 1,
        RocketLauncher: 1,
        LaserTurret: 1,
        SlowRocketLauncher: 1,
        NuclearLauncher: 1,
        GrenadeThrower: 1,
      },
      turretDamageByType: {
        BulletShooter: 1,
        RocketLauncher: 1,
        LaserTurret: 1,
        SlowRocketLauncher: 1,
        NuclearLauncher: 1,
        GrenadeThrower: 1,
      },
      turretSpeedByType: {
        BulletShooter: 1,
        RocketLauncher: 1,
        LaserTurret: 1,
        SlowRocketLauncher: 1,
        NuclearLauncher: 1,
        GrenadeThrower: 1,
      },
      damageTypeEffectiveness: {
        bullet: 1,
        explosive: 1,
        energy: 1,
        slowExplosive: 1,
      },
      upgradeCostMultiplier: 1,
    },
  };
}

function cloneCandidate(candidate) {
  return JSON.parse(JSON.stringify(candidate));
}

function mutateCandidate(base, rng) {
  const next = cloneCandidate(base);

  function nudge(obj, key, amount, min, max) {
    obj[key] = clamp(obj[key] + (rng.next() * 2 - 1) * amount, min, max);
  }

  nudge(next.wave, 'healthGrowth', 0.015, 0.03, 0.12);
  nudge(next.wave, 'speedGrowth', 0.0035, 0.002, 0.02);
  nudge(next.wave, 'earlyHealthMultiplier', 0.12, 0.5, 1.0);
  nudge(next.wave, 'earlySpeedMultiplier', 0.1, 0.6, 1.0);
  next.wave.earlyWaves = rng.int(2, 6);
  nudge(next.wave, 'rewardGrowth', 0.02, 0.02, 0.12);
  nudge(next.wave, 'countGrowth', 0.45, 0.8, 2.4);
  nudge(next.wave, 'spawnBaseMs', 130, 1000, 1800);
  nudge(next.wave, 'spawnDecayMs', 10, 10, 55);
  nudge(next.wave, 'spawnMinMs', 45, 320, 620);

  nudge(next.economy, 'startMoney', 12, 70, 140);
  nudge(next.economy, 'reserveIntermissionBase', 7, 0, 50);
  nudge(next.economy, 'reserveIntermissionPerWave', 1.4, 0, 8);
  nudge(next.economy, 'reserveSpawningBase', 8, 0, 80);
  nudge(next.economy, 'reserveSpawningPerWave', 1.8, 0, 10);
  nudge(next.economy, 'reserveCleanupBase', 6, 0, 50);
  nudge(next.economy, 'reserveCleanupPerWave', 1.2, 0, 8);

  nudge(next.ai, 'diversityPenalty', 0.12, 0.2, 0.85);
  nudge(next.ai, 'compositionStrength', 0.5, 0.5, 4.0);
  nudge(next.ai, 'upgradePreference', 0.18, 0.6, 1.3);
  nudge(next.ai, 'rangeUtilityPerLevel', 0.02, 0, 0.08);

  for (const key of Object.keys(next.multipliers.turretCostByType)) {
    nudge(next.multipliers.turretCostByType, key, 0.15, 0.75, 1.7);
    nudge(next.multipliers.turretDamageByType, key, 0.14, 0.75, 1.5);
    nudge(next.multipliers.turretSpeedByType, key, 0.12, 0.75, 1.4);
  }

  for (const key of Object.keys(next.multipliers.damageTypeEffectiveness)) {
    nudge(next.multipliers.damageTypeEffectiveness, key, 0.12, 0.7, 1.5);
  }

  nudge(next.multipliers, 'upgradeCostMultiplier', 0.16, 0.7, 1.8);

  return next;
}

function getDamageTypeTargets(waveNumber) {
  if (waveNumber <= 5) {
    return {
      bullet: 0.4,
      explosive: 0.35,
      energy: 0.2,
      slowExplosive: 0.05,
    };
  }
  if (waveNumber <= 10) {
    return {
      bullet: 0.3,
      explosive: 0.35,
      energy: 0.25,
      slowExplosive: 0.1,
    };
  }

  return {
    bullet: 0.22,
    explosive: 0.33,
    energy: 0.3,
    slowExplosive: 0.15,
  };
}

function getReserveMoney(state, candidate, waveNumber) {
  if (state.phase === 'intermission') {
    if (state.intermissionRemainingMs <= 1200) {
      return 0;
    }

    return Math.min(120, candidate.economy.reserveIntermissionBase + candidate.economy.reserveIntermissionPerWave * waveNumber);
  }

  if (state.phase === 'spawning') {
    return Math.min(180, candidate.economy.reserveSpawningBase + candidate.economy.reserveSpawningPerWave * waveNumber);
  }

  return Math.min(120, candidate.economy.reserveCleanupBase + candidate.economy.reserveCleanupPerWave * waveNumber);
}

function buildTowerMetrics(config, moduleRef) {
  const upgradeType = moduleRef.UpgradeType;
  return moduleRef.getTurretConfigs().map(turret => {
    const damageL1 = getUpgradeDetail(turret, upgradeType.Damage, 1).value;
    const speedL1 = getUpgradeDetail(turret, upgradeType.Speed, 1).value;
    const cost = turret.cost * config.multipliers.turretCostByType[turret.type];
    const damageType = moduleRef.getDamageTypeForWeaponType(turret.type);
    const damage = damageL1 * config.multipliers.turretDamageByType[turret.type];
    const speed = speedL1 / config.multipliers.turretSpeedByType[turret.type];
    const dps = damage / (speed / 1000);

    return {
      type: turret.type,
      damageType,
      baseCost: cost,
      dps,
      dpsPerGold: dps / cost,
    };
  });
}

function getUnlockedEnemies(enemyConfigs, waveNumber) {
  if (waveNumber <= 3) return enemyConfigs.slice(0, 1);
  if (waveNumber <= 5) return enemyConfigs.slice(0, 2);
  if (waveNumber <= 7) return enemyConfigs.slice(0, 3);
  if (waveNumber <= 9) return enemyConfigs.slice(0, 5);
  if (waveNumber <= 11) return enemyConfigs.slice(0, 7);
  if (waveNumber <= 13) return enemyConfigs.slice(0, 9);
  return enemyConfigs;
}

function getEnemyWeights(unlocked, waveNumber) {
  return unlocked.map((_, index) => 1 + index * 0.25 + (waveNumber - 1) * index * 0.03);
}

function normalizeWeights(weights) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(weight => weight / total);
}

function getWaveEnemyCount(waveNumber, candidate) {
  return waveNumber === 1 ? 2 : 3 + Math.floor((waveNumber - 1) * candidate.wave.countGrowth);
}

function getSpawnIntervalMs(waveNumber, candidate) {
  return Math.max(candidate.wave.spawnMinMs, candidate.wave.spawnBaseMs - (waveNumber - 1) * candidate.wave.spawnDecayMs);
}

function getWaveProfile(enemyConfigs, waveNumber, candidate, enemyTypeEnum) {
  const unlocked = getUnlockedEnemies(enemyConfigs, waveNumber);
  const weights = normalizeWeights(getEnemyWeights(unlocked, waveNumber));
  const count = getWaveEnemyCount(waveNumber, candidate);

  const healthMultiplier = 1 + (waveNumber - 1) * candidate.wave.healthGrowth;
  const speedMultiplier = Math.min(1.45, 1 + (waveNumber - 1) * candidate.wave.speedGrowth);
  const rewardMultiplier = 1 + (waveNumber - 1) * candidate.wave.rewardGrowth;

  const earlyHealth = waveNumber <= candidate.wave.earlyWaves ? candidate.wave.earlyHealthMultiplier : 1;
  const earlySpeed = waveNumber <= candidate.wave.earlyWaves ? candidate.wave.earlySpeedMultiplier : 1;

  let avgHealth = 0;
  let avgSpeed = 0;
  let avgReward = 0;
  let avgBaseDamage = 0;
  const armorWeights = {};

  for (let i = 0; i < unlocked.length; i++) {
    const enemy = unlocked[i];
    const w = weights[i];
    avgHealth += enemy.health * healthMultiplier * earlyHealth * w;
    avgSpeed += enemy.speed * speedMultiplier * earlySpeed * w;
    avgReward += enemy.reward * rewardMultiplier * w;
    avgBaseDamage += getBaseDamageByEnemyType(enemy.type, enemyTypeEnum) * w;
    armorWeights[enemy.armorClass] = (armorWeights[enemy.armorClass] ?? 0) + w;
  }

  return {
    count,
    avgHealth,
    avgSpeed,
    avgReward,
    avgBaseDamage,
    armorWeights,
    totalWaveHealth: avgHealth * count,
    totalWaveReward: avgReward * count,
  };
}

function getCoverageWeight(damageType, armorWeights, moduleRef, candidate) {
  let total = 0;
  for (const [armorClass, weight] of Object.entries(armorWeights)) {
    const base = moduleRef.getDamageMultiplier(damageType, armorClass);
    const tuned = base * candidate.multipliers.damageTypeEffectiveness[damageType];
    total += tuned * weight;
  }
  return total || 1;
}

function getCurrentDamageMix(towers) {
  const mix = {
    bullet: 0,
    explosive: 0,
    energy: 0,
    slowExplosive: 0,
  };

  for (const tower of towers) {
    mix[tower.damageType] += tower.rawDps;
  }
  return mix;
}

function getCompositionBoost(damageType, mix, waveNumber, candidate) {
  const targets = getDamageTypeTargets(waveNumber);
  const total = mix.bullet + mix.explosive + mix.energy + mix.slowExplosive;
  const currentShare = total > 0 ? mix[damageType] / total : 0;
  const deficit = Math.max(0, targets[damageType] - currentShare);
  return 1 + deficit * candidate.ai.compositionStrength;
}

function getTowerBuildScore(metric, armorWeights, builtTypeCounts, mix, waveNumber, candidate, moduleRef) {
  const count = builtTypeCounts.get(metric.type) ?? 0;
  const diversity = 1 / (1 + count * candidate.ai.diversityPenalty);
  const coverage = getCoverageWeight(metric.damageType, armorWeights, moduleRef, candidate);
  const composition = getCompositionBoost(metric.damageType, mix, waveNumber, candidate);
  return metric.dpsPerGold * diversity * coverage * composition;
}

function getTowerConfig(moduleRef, type) {
  return moduleRef.getTurretConfig(type);
}

function getUpgradedStats(tower, moduleRef, candidate) {
  const cfg = getTowerConfig(moduleRef, tower.type);
  const speed =
    getUpgradeDetail(cfg, moduleRef.UpgradeType.Speed, tower.levels.speedLevel).value /
    candidate.multipliers.turretSpeedByType[tower.type];
  const damage =
    getUpgradeDetail(cfg, moduleRef.UpgradeType.Damage, tower.levels.powerLevel).value *
    candidate.multipliers.turretDamageByType[tower.type];
  const range = getUpgradeDetail(cfg, moduleRef.UpgradeType.Range, tower.levels.rangeLevel).value;
  return {
    speed,
    damage,
    range,
    rawDps: damage / (speed / 1000),
  };
}

function getUpgradeCost(moduleRef, towerType, upgradeType, newLevel, candidate) {
  const cfg = getTowerConfig(moduleRef, towerType);
  const detail = getUpgradeDetail(cfg, upgradeType, newLevel);
  return detail.cost * candidate.multipliers.upgradeCostMultiplier;
}

function selectAction({
  candidate,
  moduleRef,
  waveNumber,
  profile,
  towerMetrics,
  towers,
  wallet,
}) {
  const mix = getCurrentDamageMix(towers);
  const builtTypeCounts = towers.reduce((acc, tower) => {
    acc.set(tower.type, (acc.get(tower.type) ?? 0) + 1);
    return acc;
  }, new Map());

  const affordableBuilds = towerMetrics.filter(metric => metric.baseCost <= wallet);

  let bestBuild = null;
  if (affordableBuilds.length > 0) {
    affordableBuilds.sort(
      (a, b) =>
        getTowerBuildScore(b, profile.armorWeights, builtTypeCounts, mix, waveNumber, candidate, moduleRef) -
        getTowerBuildScore(a, profile.armorWeights, builtTypeCounts, mix, waveNumber, candidate, moduleRef)
    );
    const chosen = affordableBuilds[0];
    bestBuild = {
      kind: 'build',
      towerType: chosen.type,
      cost: chosen.baseCost,
      score: getTowerBuildScore(chosen, profile.armorWeights, builtTypeCounts, mix, waveNumber, candidate, moduleRef),
      dpsGain: chosen.dps,
      damageType: chosen.damageType,
    };
  }

  let bestUpgrade = null;
  for (const tower of towers) {
    for (const upgradeType of [moduleRef.UpgradeType.Damage, moduleRef.UpgradeType.Speed, moduleRef.UpgradeType.Range]) {
      const levelKey =
        upgradeType === moduleRef.UpgradeType.Damage
          ? 'powerLevel'
          : upgradeType === moduleRef.UpgradeType.Speed
            ? 'speedLevel'
            : 'rangeLevel';

      const currentLevel = tower.levels[levelKey];
      if (currentLevel >= 5) {
        continue;
      }

      const newLevel = currentLevel + 1;
      const cost = getUpgradeCost(moduleRef, tower.type, upgradeType, newLevel, candidate);
      if (cost > wallet) {
        continue;
      }

      const nextTower = {
        ...tower,
        levels: {
          ...tower.levels,
          [levelKey]: newLevel,
        },
      };
      const prevStats = getUpgradedStats(tower, moduleRef, candidate);
      const nextStats = getUpgradedStats(nextTower, moduleRef, candidate);

      const rangeUtil =
        upgradeType === moduleRef.UpgradeType.Range
          ? 1 + candidate.ai.rangeUtilityPerLevel * newLevel
          : 1;

      const rawGain = Math.max(0, nextStats.rawDps - prevStats.rawDps) * rangeUtil;
      if (rawGain <= 0) {
        continue;
      }

      const coverage = getCoverageWeight(tower.damageType, profile.armorWeights, moduleRef, candidate);
      const composition = getCompositionBoost(tower.damageType, mix, waveNumber, candidate);
      const score = (rawGain / cost) * coverage * composition;

      if (!bestUpgrade || score > bestUpgrade.score) {
        bestUpgrade = {
          kind: 'upgrade',
          tower,
          upgradeType,
          levelKey,
          newLevel,
          cost,
          dpsGain: rawGain,
          score,
        };
      }
    }
  }

  if (bestUpgrade && (!bestBuild || bestUpgrade.score >= bestBuild.score * candidate.ai.upgradePreference)) {
    return bestUpgrade;
  }

  return bestBuild;
}

function simulateRun({
  seed,
  maxWaves,
  targetWave,
  candidate,
  moduleRef,
  routeLength,
}) {
  const rng = createRng(seed);
  const enemyConfigs = moduleRef.enemyConfigs;

  const towerMetrics = buildTowerMetrics(candidate, moduleRef);
  const towers = [];
  const buildCounts = new Map();

  let wallet = candidate.economy.startMoney;
  let baseHealth = 20;
  let previousReward = 0;
  let reachedWave = 0;
  let totalLeaks = 0;
  let terminalEffectivePressure = 0;

  for (let waveNumber = 1; waveNumber <= maxWaves; waveNumber++) {
    wallet += previousReward;
    const profile = getWaveProfile(enemyConfigs, waveNumber, candidate, moduleRef.EnemyType);

    const phases = [
      { phase: 'intermission', intermissionRemainingMs: 6000 },
      { phase: 'intermission', intermissionRemainingMs: 800 },
      { phase: 'spawning', intermissionRemainingMs: 0 },
    ];

    for (const phaseState of phases) {
      const reserve = getReserveMoney(phaseState, candidate, waveNumber);
      let available = wallet - reserve;
      let safety = 0;
      while (available > 0 && safety < 100) {
        safety++;
        const action = selectAction({
          candidate,
          moduleRef,
          waveNumber,
          profile,
          towerMetrics,
          towers,
          wallet: available,
        });

        if (!action) {
          break;
        }

        if (action.kind === 'build') {
          const baseTower = {
            type: action.towerType,
            damageType: action.damageType,
            levels: {
              speedLevel: 1,
              powerLevel: 1,
              rangeLevel: 1,
            },
          };
          const stats = getUpgradedStats(baseTower, moduleRef, candidate);
          towers.push({ ...baseTower, ...stats });
          buildCounts.set(action.towerType, (buildCounts.get(action.towerType) ?? 0) + 1);
          wallet -= action.cost;
        } else {
          action.tower.levels[action.levelKey] = action.newLevel;
          const updated = getUpgradedStats(action.tower, moduleRef, candidate);
          action.tower.speed = updated.speed;
          action.tower.damage = updated.damage;
          action.tower.range = updated.range;
          action.tower.rawDps = updated.rawDps;
          wallet -= action.cost;
        }

        available = wallet - reserve;
      }
    }

    const spawnDurationSec = ((profile.count - 1) * getSpawnIntervalMs(waveNumber, candidate)) / 1000;
    const travelDurationSec = routeLength / profile.avgSpeed;
    const waveDurationSec = Math.max(1, spawnDurationSec + travelDurationSec);
    const requiredDps = profile.totalWaveHealth / waveDurationSec;

    const builtEffectiveDps = towers.reduce((sum, tower) => {
      const coverage = getCoverageWeight(tower.damageType, profile.armorWeights, moduleRef, candidate);
      const rangeUtility = 1 + candidate.ai.rangeUtilityPerLevel * (tower.levels.rangeLevel - 1);
      return sum + tower.rawDps * coverage * rangeUtility;
    }, 0);

    const pressure = requiredDps > 0 ? builtEffectiveDps / requiredDps : 0;
    terminalEffectivePressure = pressure;
    const clearRatio = clamp(Math.pow(Math.max(0, pressure), 0.85), 0, 1);

    const leaks = Math.max(0, Math.round(profile.count * (1 - clearRatio)));
    totalLeaks += leaks;
    baseHealth -= Math.round(leaks * profile.avgBaseDamage);

    previousReward = profile.totalWaveReward * clearRatio;
    reachedWave = waveNumber;

    if (baseHealth <= 0) {
      break;
    }

    if (rng.next() < 0.05) {
      const tax = Math.max(0, wallet * 0.05);
      wallet -= tax;
    }
  }

  const uniqueTypes = buildCounts.size;
  const totalBuilt = Array.from(buildCounts.values()).reduce((a, b) => a + b, 0);
  const diversity = totalBuilt > 0 ? uniqueTypes / 6 : 0;

  const reachPenalty = Math.abs(reachedWave - targetWave) * 8;
  const overEasyPenalty = reachedWave >= maxWaves ? Math.max(0, wallet - 120) * 0.35 : 0;
  const terminalPressurePenalty = reachedWave >= maxWaves ? Math.max(0, terminalEffectivePressure - 1.3) * 120 : 0;
  const terminalWalletPenalty = reachedWave >= maxWaves ? Math.max(0, wallet - 80) * 0.5 : 0;
  const hardPenalty = reachedWave < 8 ? (8 - reachedWave) * 35 : 0;
  const moneyPenalty = Math.max(0, wallet - 90) * 0.12;
  const leakPenalty = totalLeaks * 0.9;
  const diversityPenalty = (1 - diversity) * 80;

  const score =
    reachPenalty +
    overEasyPenalty +
    terminalPressurePenalty +
    terminalWalletPenalty +
    hardPenalty +
    moneyPenalty +
    leakPenalty +
    diversityPenalty;

  return {
    seed,
    reachedWave,
    wallet,
    baseHealth,
    totalLeaks,
    diversity,
    terminalEffectivePressure,
    score,
  };
}

function evaluateCandidate({ candidate, seeds, maxWaves, targetWave, moduleRef, routeLength }) {
  const runs = seeds.map(seed =>
    simulateRun({
      seed,
      maxWaves,
      targetWave,
      candidate,
      moduleRef,
      routeLength,
    })
  );

  const mean = key => runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
  const variance = key => {
    const avg = mean(key);
    return runs.reduce((sum, run) => sum + (run[key] - avg) ** 2, 0) / runs.length;
  };

  const avgScore = mean('score');
  const score = avgScore + variance('reachedWave') * 2.5 + variance('wallet') * 0.02;

  return {
    score,
    avgReachedWave: mean('reachedWave'),
    avgWallet: mean('wallet'),
    avgLeaks: mean('totalLeaks'),
    avgDiversity: mean('diversity'),
    avgTerminalPressure: mean('terminalEffectivePressure'),
    runs,
  };
}

function parseArg(args, name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1) {
    return fallback;
  }

  const value = Number(args[idx + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function main() {
  const args = process.argv.slice(2);
  const generations = Math.max(1, Math.floor(parseArg(args, '--generations', 30)));
  const population = Math.max(8, Math.floor(parseArg(args, '--population', 48)));
  const seedCount = Math.max(3, Math.floor(parseArg(args, '--seeds', 12)));
  const maxWaves = Math.max(5, Math.floor(parseArg(args, '--maxWaves', 20)));
  const targetWave = Math.max(5, Math.floor(parseArg(args, '--targetWave', 14)));
  const verbose = args.includes('--verbose');

  const moduleRef = loadTsModule(path.join(ROOT, 'src/app/models/configs/turret-config.model.ts'));
  const route = parseFixedRoute(path.join(ROOT, 'src/app/services/game/grid.service.ts'));
  const routeLength = computeRouteLength(route);

  const seeds = Array.from({ length: seedCount }, (_, idx) => 1337 + idx * 17);
  const rng = createRng(20260309);

  const initial = getDefaultCandidate();
  let populationSet = [initial];
  while (populationSet.length < population) {
    populationSet.push(mutateCandidate(initial, rng));
  }

  let best = null;

  for (let gen = 1; gen <= generations; gen++) {
    const scored = populationSet.map(candidate => {
      const metrics = evaluateCandidate({
        candidate,
        seeds,
        maxWaves,
        targetWave,
        moduleRef,
        routeLength,
      });
      return {
        candidate,
        metrics,
      };
    });

    scored.sort((a, b) => a.metrics.score - b.metrics.score);

    if (!best || scored[0].metrics.score < best.metrics.score) {
      best = scored[0];
    }

    const elites = scored.slice(0, Math.max(4, Math.floor(population * 0.18)));

    const top = scored[0];
    console.log(
      `Generation ${String(gen).padStart(2)} finished | score=${format(top.metrics.score, 2)} | avgWave=${format(top.metrics.avgReachedWave, 2)} | avgWallet=${format(top.metrics.avgWallet, 1)} | avgLeaks=${format(top.metrics.avgLeaks, 2)} | avgEffP=${format(top.metrics.avgTerminalPressure, 2)} | diversity=${format(top.metrics.avgDiversity, 3)}`
    );

    if (verbose && gen % 10 === 0) {
      console.log(`Top candidate snapshot at generation ${gen}:`, JSON.stringify(top.candidate));
    }

    const next = elites.map(item => cloneCandidate(item.candidate));

    while (next.length < population) {
      const parent = elites[rng.int(0, elites.length - 1)].candidate;
      next.push(mutateCandidate(parent, rng));
    }

    populationSet = next;
  }

  const outputDir = path.join(ROOT, 'scripts', 'out');
  fs.mkdirSync(outputDir, { recursive: true });

  const result = {
    meta: {
      createdAt: new Date().toISOString(),
      generations,
      population,
      seedCount,
      maxWaves,
      targetWave,
      routeLength,
    },
    objective: {
      description: 'Minimize score for target reachability + low excess money + diversity + stability',
      bestScore: best.metrics.score,
      avgReachedWave: best.metrics.avgReachedWave,
      avgWallet: best.metrics.avgWallet,
      avgLeaks: best.metrics.avgLeaks,
      avgDiversity: best.metrics.avgDiversity,
      avgTerminalPressure: best.metrics.avgTerminalPressure,
    },
    bestCandidate: best.candidate,
    runs: best.metrics.runs,
  };

  const jsonPath = path.join(outputDir, 'balance-config.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const snippet = `/* Auto-generated by balance:train */\nexport const trainedBalanceConfig = ${JSON.stringify(
    best.candidate,
    null,
    2
  )} as const;\n`;
  const snippetPath = path.join(outputDir, 'balance-config-snippet.ts');
  fs.writeFileSync(snippetPath, snippet, 'utf8');

  console.log('\n=== Training complete ===');
  console.log(`Best score: ${format(best.metrics.score, 2)}`);
  console.log(`Average reached wave: ${format(best.metrics.avgReachedWave, 2)}`);
  console.log(`Average end wallet: ${format(best.metrics.avgWallet, 1)}`);
  console.log(`Average leaks: ${format(best.metrics.avgLeaks, 2)}`);
  console.log(`Average terminal effective pressure: ${format(best.metrics.avgTerminalPressure, 2)}`);
  console.log(`Average diversity: ${format(best.metrics.avgDiversity, 3)}`);
  console.log(`\nWrote: ${path.relative(ROOT, jsonPath)}`);
  console.log(`Wrote: ${path.relative(ROOT, snippetPath)}`);
}

main();
