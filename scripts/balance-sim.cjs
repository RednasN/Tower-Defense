#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = process.cwd();
let runtimeConfig = null;

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

function getUpgradeValue(config, type, level) {
  const upgrade = config.upgrades.find(item => item.type === type);
  if (!upgrade) {
    throw new Error(`Missing upgrade type '${type}' for turret ${config.type}`);
  }
  const detail = upgrade.details.find(item => item.level === level);
  if (!detail) {
    throw new Error(`Missing level ${level} for upgrade '${type}' turret ${config.type}`);
  }
  return detail.value;
}

function getTowerMetrics(turretConfigs, upgradeType, getDamageTypeForWeaponType) {
  return turretConfigs.map(config => {
    const damage = getUpgradeValue(config, upgradeType.Damage, 1);
    const speedMs = getUpgradeValue(config, upgradeType.Speed, 1);
    const dps = damage / (speedMs / 1000);
    return {
      type: config.type,
      damageType: getDamageTypeForWeaponType(config.type),
      cost: config.cost,
      dps,
      dpsPerGold: dps / config.cost,
    };
  });
}

function waveEnemyCount(waveNumber) {
  return waveNumber === 1 ? 2 : 3 + Math.floor((waveNumber - 1) * runtimeConfig.wave.countGrowth);
}

function spawnIntervalMs(waveNumber) {
  return Math.max(runtimeConfig.wave.spawnMinMs, runtimeConfig.wave.spawnBaseMs - (waveNumber - 1) * runtimeConfig.wave.spawnDecayMs);
}

function unlockedEnemies(enemyConfigs, waveNumber) {
  if (waveNumber <= 3) return enemyConfigs.slice(0, 1);
  if (waveNumber <= 5) return enemyConfigs.slice(0, 2);
  if (waveNumber <= 7) return enemyConfigs.slice(0, 3);
  if (waveNumber <= 9) return enemyConfigs.slice(0, 5);
  if (waveNumber <= 11) return enemyConfigs.slice(0, 7);
  if (waveNumber <= 13) return enemyConfigs.slice(0, 9);
  return enemyConfigs;
}

function enemyWeights(unlocked, waveNumber) {
  return unlocked.map((_, index) => 1 + index * 0.25 + (waveNumber - 1) * index * 0.03);
}

function normalizedWeights(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(weight => weight / total);
}

function expectedWaveProfile(enemyConfigs, waveNumber) {
  const unlocked = unlockedEnemies(enemyConfigs, waveNumber);
  const count = waveEnemyCount(waveNumber);
  const weights = normalizedWeights(enemyWeights(unlocked, waveNumber));

  const lateWaveHealthFactor = waveNumber >= 12 ? 1.12 : 1;
  const lateWaveRewardFactor = waveNumber >= 12 ? 0.82 : 1;
  const healthMultiplier = (1 + (waveNumber - 1) * runtimeConfig.wave.healthGrowth) * lateWaveHealthFactor;
  const speedMultiplier = Math.min(1.45, 1 + (waveNumber - 1) * runtimeConfig.wave.speedGrowth);
  const earlyWaveHealthMultiplier = waveNumber <= runtimeConfig.wave.earlyWaves ? runtimeConfig.wave.earlyHealthMultiplier : 1;
  const earlyWaveSpeedMultiplier = waveNumber <= runtimeConfig.wave.earlyWaves ? runtimeConfig.wave.earlySpeedMultiplier : 1;
  const rewardMultiplier = (1 + (waveNumber - 1) * runtimeConfig.wave.rewardGrowth) * lateWaveRewardFactor;

  let avgHealth = 0;
  let avgSpeed = 0;
  let avgReward = 0;
  const armorWeights = {};

  for (let i = 0; i < unlocked.length; i++) {
    const enemy = unlocked[i];
    const weight = weights[i];
    avgHealth += enemy.health * healthMultiplier * earlyWaveHealthMultiplier * weight;
    avgSpeed += enemy.speed * speedMultiplier * earlyWaveSpeedMultiplier * weight;
    avgReward += enemy.reward * rewardMultiplier * weight;
    armorWeights[enemy.armorClass] = (armorWeights[enemy.armorClass] ?? 0) + weight;
  }

  return {
    count,
    avgHealth,
    avgSpeed,
    avgReward,
    armorWeights,
    totalWaveHealth: avgHealth * count,
    totalWaveReward: avgReward * count,
  };
}

function format(num, digits = 2) {
  return Number(num).toFixed(digits);
}

function getCoverageWeight(damageType, armorWeights, getDamageMultiplier) {
  let weighted = 0;
  for (const [armorClass, weight] of Object.entries(armorWeights)) {
    weighted += getDamageMultiplier(damageType, armorClass) * weight;
  }
  return weighted || 1;
}

function getEffectiveDpsByDamageType(rawDpsByType, armorWeights, getDamageMultiplier) {
  let total = 0;
  for (const [damageType, rawDps] of Object.entries(rawDpsByType)) {
    total += rawDps * getCoverageWeight(damageType, armorWeights, getDamageMultiplier);
  }
  return total;
}

function simulatePurchases(towerMetrics, wallet, profile, builtCounts, getDamageMultiplier) {
  const purchases = [];
  let remaining = wallet;
  const cheapestCost = Math.min(...towerMetrics.map(tower => tower.cost));
  let addedDps = 0;
  const estimatedDamageByType = {};

  while (remaining >= cheapestCost) {
    const affordableTowers = towerMetrics.filter(tower => tower.cost <= remaining);
    if (affordableTowers.length === 0) {
      break;
    }

    affordableTowers.sort((a, b) => {
      const aCount = builtCounts[a.type] ?? 0;
      const bCount = builtCounts[b.type] ?? 0;
      const aScore =
        a.dpsPerGold *
        getCoverageWeight(a.damageType, profile.armorWeights, getDamageMultiplier) *
        (1 / (1 + aCount * runtimeConfig.ai.diversityPenalty));
      const bScore =
        b.dpsPerGold *
        getCoverageWeight(b.damageType, profile.armorWeights, getDamageMultiplier) *
        (1 / (1 + bCount * runtimeConfig.ai.diversityPenalty));
      return bScore - aScore;
    });

    const selectedTower = affordableTowers[0];
    remaining -= selectedTower.cost;
    addedDps += selectedTower.dps;
    purchases.push(selectedTower.type);
    builtCounts[selectedTower.type] = (builtCounts[selectedTower.type] ?? 0) + 1;
    estimatedDamageByType[selectedTower.damageType] = (estimatedDamageByType[selectedTower.damageType] ?? 0) + selectedTower.dps;
  }

  return {
    purchases,
    addedDps,
    remainingWallet: remaining,
    estimatedDamageByType,
  };
}

function run() {
  const args = process.argv.slice(2);
  const maxWave = Number(args[0] ?? 20);
  const showBuilds = args.includes('--show-builds');

  if (!Number.isFinite(maxWave) || maxWave < 1) {
    throw new Error('Usage: npm run balance:sim -- [maxWave] [--show-builds]');
  }

  const turretConfigModule = loadTsModule(path.join(ROOT, 'src/app/models/configs/turret-config.model.ts'));
  const runtimeConfigModule = loadTsModule(path.join(ROOT, 'src/app/models/configs/balance-runtime-config.ts'));
  runtimeConfig = runtimeConfigModule.balanceRuntimeConfig;
  const route = parseFixedRoute(path.join(ROOT, 'src/app/services/game/grid.service.ts'));
  const routeLength = computeRouteLength(route);

  const enemyConfigs = turretConfigModule.enemyConfigs;
  const turretConfigs = turretConfigModule.getTurretConfigs();
  const upgradeType = turretConfigModule.UpgradeType;

  const towerMetrics = getTowerMetrics(turretConfigs, upgradeType, turretConfigModule.getDamageTypeForWeaponType).sort(
    (a, b) => b.dpsPerGold - a.dpsPerGold
  );
  const bestTower = towerMetrics[0];

  let wallet = Math.round(runtimeConfig.economy.startMoney);
  let currentRawDps = 0;
  let previousWaveReward = 0;
  const builtCounts = {};
  const estimatedDamageByType = {};

  const startMoney = Math.round(runtimeConfig.economy.startMoney);

  console.log('=== Balance Simulation (pressure vs economy) ===');
  console.log(`Route length(px): ${format(routeLength, 0)}`);
  console.log(`Best L1 DPS/gold: ${bestTower.type} (cost ${bestTower.cost}, DPS ${format(bestTower.dps)}, DPS/g ${format(bestTower.dpsPerGold, 4)})`);
  console.log('');
  console.log('CLI note: this is an economic approximation; live replay is balancing truth.');
  console.log('');
  console.log('Wave | Enemies | AvgHP | AvgSpeed | ReqDPS | Income$ | Spend$ | EndWallet$ | RawDPS | EffDPS | RawP | EffP | Reward$ | Leaks');
  console.log('-----|---------|-------|----------|--------|---------|--------|-----------|--------|--------|------|------|---------|------');

  for (let wave = 1; wave <= maxWave; wave++) {
    const profile = expectedWaveProfile(enemyConfigs, wave);
    const waveIncome = previousWaveReward;
    wallet += waveIncome;
    const walletBeforeBuild = wallet;
    const buildStep = simulatePurchases(towerMetrics, wallet, profile, builtCounts, turretConfigModule.getDamageMultiplier);
    wallet = buildStep.remainingWallet;
    const waveSpend = walletBeforeBuild - wallet;
    currentRawDps += buildStep.addedDps;
    for (const [type, value] of Object.entries(buildStep.estimatedDamageByType)) {
      estimatedDamageByType[type] = (estimatedDamageByType[type] ?? 0) + value;
    }

    const spawnDurationSec = ((profile.count - 1) * spawnIntervalMs(wave)) / 1000;
    const travelDurationSec = routeLength / profile.avgSpeed;
    const waveDurationSec = Math.max(1, spawnDurationSec + travelDurationSec);

    const requiredDps = profile.totalWaveHealth / waveDurationSec;
    const effectiveDps = getEffectiveDpsByDamageType(estimatedDamageByType, profile.armorWeights, turretConfigModule.getDamageMultiplier);
    const rawPressure = currentRawDps / requiredDps;
    const effectivePressure = effectiveDps / requiredDps;
    const clearRatio = Math.min(1, effectivePressure);
    const realizedReward = profile.totalWaveReward * clearRatio;
    const leaks = Math.max(0, Math.round(profile.count * (1 - clearRatio)));
    previousWaveReward = realizedReward;

    console.log(
      `${String(wave).padStart(4)} | ${String(profile.count).padStart(7)} | ${String(format(profile.avgHealth, 1)).padStart(5)} | ${String(
        format(profile.avgSpeed, 0)
      ).padStart(8)} | ${String(format(requiredDps, 1)).padStart(6)} | ${String(format(waveIncome, 0)).padStart(7)} | ${String(
        format(waveSpend, 0)
      ).padStart(6)} | ${String(format(wallet, 0)).padStart(9)} | ${String(format(currentRawDps, 1)).padStart(6)} | ${String(
        format(effectiveDps, 1)
      ).padStart(6)} | ${String(format(rawPressure, 2)).padStart(4)} | ${String(format(effectivePressure, 2)).padStart(4)} | ${String(
        format(realizedReward, 0)
      ).padStart(7)} | ${String(leaks).padStart(5)}`
    );

    if (showBuilds) {
      if (buildStep.purchases.length === 0) {
        console.log(`      builds: none`);
      } else {
        const grouped = buildStep.purchases.reduce((acc, type) => {
          acc[type] = (acc[type] ?? 0) + 1;
          return acc;
        }, {});

        const summary = Object.entries(grouped)
          .map(([type, count]) => `${count}x ${type}`)
          .join(', ');
        console.log(`      builds: ${summary}`);
      }
    }
  }

  console.log('');
  console.log('Interpretation:');
  console.log('- Effective pressure < 0.9: likely too hard');
  console.log('- Effective pressure 0.9-1.2: challenging/fair target band');
  console.log('- Effective pressure > 1.2: likely too easy (or economy too generous)');
  console.log('');
  console.log('Per-tower L1 efficiency:');
  for (const tower of towerMetrics) {
    console.log(
      `- ${tower.type}: cost=${tower.cost}, dps=${format(tower.dps)}, dps/gold=${format(tower.dpsPerGold, 4)}, type=${tower.damageType}`
    );
  }

  console.log('');
  console.log('Estimated DPS contribution by damage type:');
  for (const [type, value] of Object.entries(estimatedDamageByType)) {
    console.log(`- ${type}: ${format(value, 2)}`);
  }

  console.log('');
  console.log(`Start money used in simulation: ${startMoney}`);
  console.log(`Final unspent wallet: ${format(wallet, 0)}`);
}

run();
