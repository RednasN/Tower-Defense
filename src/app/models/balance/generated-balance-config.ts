import { BalanceConfig } from '../configs/balance-types';

export const generatedBalanceConfig = {
  "economy": {
    "startingMoney": 90,
    "startingBaseHealth": 20,
    "hoardPenaltyThresholdMultiplier": 1.5
  },
  "damageMultipliers": {
    "bullet": {
      "light": 1.2,
      "armored": 0.7,
      "swarm": 0.95,
      "shielded": 0.8
    },
    "explosive": {
      "light": 0.95,
      "armored": 1.1,
      "swarm": 1.35,
      "shielded": 0.9
    },
    "energy": {
      "light": 0.95,
      "armored": 1.35,
      "swarm": 0.9,
      "shielded": 1.25
    },
    "slowExplosive": {
      "light": 1,
      "armored": 1.1,
      "swarm": 1.15,
      "shielded": 1
    }
  },
  "towers": [
    {
      "type": "BulletShooter",
      "imageSrc": "./assets/turrets/turret.png",
      "cost": 18,
      "projectileType": "Bullet",
      "projectileSpeed": 250,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 8,
              "value": 112
            },
            {
              "level": 2,
              "cost": 11,
              "value": 171
            },
            {
              "level": 3,
              "cost": 13,
              "value": 174
            },
            {
              "level": 4,
              "cost": 28,
              "value": 280
            },
            {
              "level": 5,
              "cost": 37,
              "value": 290
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 9,
              "value": 1.58
            },
            {
              "level": 2,
              "cost": 10,
              "value": 1.76
            },
            {
              "level": 3,
              "cost": 18,
              "value": 1.626
            },
            {
              "level": 4,
              "cost": 24,
              "value": 3.75
            },
            {
              "level": 5,
              "cost": 29,
              "value": 4.15
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 4,
              "value": 2200
            },
            {
              "level": 2,
              "cost": 5,
              "value": 1686
            },
            {
              "level": 3,
              "cost": 14,
              "value": 1191
            },
            {
              "level": 4,
              "cost": 25,
              "value": 909
            },
            {
              "level": 5,
              "cost": 34,
              "value": 763
            }
          ]
        }
      ]
    },
    {
      "type": "RocketLauncher",
      "imageSrc": "./assets/turrets/rocket-launcher-basic.png",
      "cost": 52,
      "projectileType": "Rocket",
      "projectileSpeed": 125,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 5,
              "value": 154
            },
            {
              "level": 2,
              "cost": 11,
              "value": 245
            },
            {
              "level": 3,
              "cost": 21,
              "value": 245
            },
            {
              "level": 4,
              "cost": 37,
              "value": 337
            },
            {
              "level": 5,
              "cost": 44,
              "value": 371
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 8,
              "value": 2.7
            },
            {
              "level": 2,
              "cost": 23,
              "value": 3.8
            },
            {
              "level": 3,
              "cost": 38,
              "value": 4.4
            },
            {
              "level": 4,
              "cost": 57,
              "value": 6.2
            },
            {
              "level": 5,
              "cost": 76,
              "value": 7.8
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 8,
              "value": 2050
            },
            {
              "level": 2,
              "cost": 34,
              "value": 1900
            },
            {
              "level": 3,
              "cost": 47,
              "value": 1730
            },
            {
              "level": 4,
              "cost": 65,
              "value": 1447
            },
            {
              "level": 5,
              "cost": 82,
              "value": 1033
            }
          ]
        }
      ]
    },
    {
      "type": "LaserTurret",
      "imageSrc": "./assets/turrets/laser-shooter.png",
      "cost": 118,
      "projectileType": "Laser",
      "projectileSpeed": null,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 15,
              "value": 66
            },
            {
              "level": 2,
              "cost": 46,
              "value": 114
            },
            {
              "level": 3,
              "cost": 68,
              "value": 128
            },
            {
              "level": 4,
              "cost": 94,
              "value": 140
            },
            {
              "level": 5,
              "cost": 110,
              "value": 152
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 24,
              "value": 2.15
            },
            {
              "level": 2,
              "cost": 38,
              "value": 2.45
            },
            {
              "level": 3,
              "cost": 74,
              "value": 2.8
            },
            {
              "level": 4,
              "cost": 96,
              "value": 3.15
            },
            {
              "level": 5,
              "cost": 142,
              "value": 4.1
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 20,
              "value": 1625
            },
            {
              "level": 2,
              "cost": 46,
              "value": 1390
            },
            {
              "level": 3,
              "cost": 78,
              "value": 1335
            },
            {
              "level": 4,
              "cost": 118,
              "value": 1275
            },
            {
              "level": 5,
              "cost": 138,
              "value": 1210
            }
          ]
        }
      ]
    },
    {
      "type": "NuclearLauncher",
      "imageSrc": "./assets/turrets/nuclear-turret.png",
      "cost": 128,
      "projectileType": "NuclearBullet",
      "projectileSpeed": 500,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 16,
              "value": 149
            },
            {
              "level": 2,
              "cost": 21,
              "value": 149
            },
            {
              "level": 3,
              "cost": 22,
              "value": 255
            },
            {
              "level": 4,
              "cost": 46,
              "value": 255
            },
            {
              "level": 5,
              "cost": 59,
              "value": 359
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 28,
              "value": 3.85
            },
            {
              "level": 2,
              "cost": 58,
              "value": 6.15
            },
            {
              "level": 3,
              "cost": 76,
              "value": 8.9
            },
            {
              "level": 4,
              "cost": 84,
              "value": 9.8
            },
            {
              "level": 5,
              "cost": 102,
              "value": 11.4
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 36,
              "value": 1760
            },
            {
              "level": 2,
              "cost": 46,
              "value": 1510
            },
            {
              "level": 3,
              "cost": 112,
              "value": 1510
            },
            {
              "level": 4,
              "cost": 100,
              "value": 1427
            },
            {
              "level": 5,
              "cost": 101,
              "value": 1173
            }
          ]
        }
      ]
    },
    {
      "type": "SlowRocketLauncher",
      "imageSrc": "./assets/turrets/slow-turret.png",
      "cost": 38,
      "projectileType": "SlowRocket",
      "projectileSpeed": 250,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 9,
              "value": 206
            },
            {
              "level": 2,
              "cost": 19,
              "value": 255
            },
            {
              "level": 3,
              "cost": 20,
              "value": 289
            },
            {
              "level": 4,
              "cost": 31,
              "value": 369
            },
            {
              "level": 5,
              "cost": 73,
              "value": 395
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 4,
              "value": 2.1
            },
            {
              "level": 2,
              "cost": 12,
              "value": 2.28
            },
            {
              "level": 3,
              "cost": 16,
              "value": 2.62
            },
            {
              "level": 4,
              "cost": 34,
              "value": 2.98
            },
            {
              "level": 5,
              "cost": 35,
              "value": 4.95
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 5,
              "value": 1568
            },
            {
              "level": 2,
              "cost": 15,
              "value": 1250
            },
            {
              "level": 3,
              "cost": 24,
              "value": 1099
            },
            {
              "level": 4,
              "cost": 37,
              "value": 1077
            },
            {
              "level": 5,
              "cost": 38,
              "value": 1077
            }
          ]
        }
      ]
    },
    {
      "type": "GrenadeThrower",
      "imageSrc": "./assets/turrets/grenade-thrower.png",
      "cost": 24,
      "projectileType": "GrenadeMine",
      "projectileSpeed": null,
      "upgrades": [
        {
          "type": "range",
          "details": [
            {
              "level": 1,
              "cost": 4,
              "value": 99
            },
            {
              "level": 2,
              "cost": 8,
              "value": 127
            },
            {
              "level": 3,
              "cost": 11,
              "value": 176
            },
            {
              "level": 4,
              "cost": 15,
              "value": 202
            },
            {
              "level": 5,
              "cost": 28,
              "value": 203
            }
          ]
        },
        {
          "type": "damage",
          "details": [
            {
              "level": 1,
              "cost": 6,
              "value": 1.729
            },
            {
              "level": 2,
              "cost": 10,
              "value": 2.9352
            },
            {
              "level": 3,
              "cost": 26,
              "value": 3.292
            },
            {
              "level": 4,
              "cost": 40,
              "value": 4.2535
            },
            {
              "level": 5,
              "cost": 41,
              "value": 5.1424
            }
          ]
        },
        {
          "type": "speed",
          "details": [
            {
              "level": 1,
              "cost": 8,
              "value": 1654
            },
            {
              "level": 2,
              "cost": 17,
              "value": 1282
            },
            {
              "level": 3,
              "cost": 18,
              "value": 1282
            },
            {
              "level": 4,
              "cost": 48,
              "value": 1282
            },
            {
              "level": 5,
              "cost": 53,
              "value": 1142
            }
          ]
        }
      ]
    }
  ],
  "enemies": [
    {
      "type": "basic",
      "health": 9,
      "speed": 235,
      "reward": 11,
      "imageName": "BasicEnemy",
      "armorClass": "light",
      "threat": 1.25,
      "unlockWave": 1,
      "weight": 1.4357,
      "baseDamageToBase": 1
    },
    {
      "type": "fastAndWeak",
      "health": 9,
      "speed": 225,
      "reward": 12,
      "imageName": "FastAndWeakEnemy",
      "armorClass": "swarm",
      "threat": 1.65,
      "unlockWave": 2,
      "weight": 2.0697,
      "baseDamageToBase": 1
    },
    {
      "type": "slowAndStrong",
      "health": 48,
      "speed": 70,
      "reward": 20,
      "imageName": "SlowAndStrongEnemy",
      "armorClass": "armored",
      "threat": 3.0,
      "unlockWave": 3,
      "weight": 0.8283,
      "baseDamageToBase": 1
    },
    {
      "type": "boss",
      "health": 42,
      "speed": 70,
      "reward": 18,
      "imageName": "BossEnemy",
      "armorClass": "shielded",
      "threat": 5.2,
      "unlockWave": 5,
      "weight": 0.4832,
      "baseDamageToBase": 3
    },
    {
      "type": "scoutTank",
      "health": 70,
      "speed": 155,
      "reward": 32,
      "imageName": "ScoutTankEnemy",
      "armorClass": "light",
      "threat": 4.05,
      "unlockWave": 3,
      "weight": 0.7139,
      "baseDamageToBase": 2
    },
    {
      "type": "siegeTank",
      "health": 92,
      "speed": 113,
      "reward": 34,
      "imageName": "SiegeTankEnemy",
      "armorClass": "armored",
      "threat": 6.4,
      "unlockWave": 5,
      "weight": 0.5568,
      "baseDamageToBase": 2
    },
    {
      "type": "lightHovercraft",
      "health": 78,
      "speed": 132,
      "reward": 35,
      "imageName": "LightHovercraftEnemy",
      "armorClass": "swarm",
      "threat": 5.6,
      "unlockWave": 6,
      "weight": 0.7056,
      "baseDamageToBase": 2
    },
    {
      "type": "heavyHovercraft",
      "health": 182,
      "speed": 113,
      "reward": 30,
      "imageName": "HeavyHovercraftEnemy",
      "armorClass": "armored",
      "threat": 8.25,
      "unlockWave": 12,
      "weight": 0.3113,
      "baseDamageToBase": 2
    },
    {
      "type": "fighterPlane",
      "health": 148,
      "speed": 228,
      "reward": 44,
      "imageName": "FighterPlaneEnemy",
      "armorClass": "swarm",
      "threat": 5.9,
      "unlockWave": 11,
      "weight": 0.2656,
      "baseDamageToBase": 3
    },
    {
      "type": "bomberPlane",
      "health": 220,
      "speed": 98,
      "reward": 72,
      "imageName": "BomberPlaneEnemy",
      "armorClass": "shielded",
      "threat": 10.2,
      "unlockWave": 9,
      "weight": 0.3509,
      "baseDamageToBase": 3
    }
  ],
  "waves": {
    "intermissionMs": 8500,
    "spawnIntervalMs": 1160,
    "spawnIntervalDecayPerWave": 38,
    "minSpawnIntervalMs": 340,
    "budgetBase": 4.1,
    "budgetGrowthLinear": 1.8,
    "budgetGrowthPower": 1.3422,
    "budgetGrowthFactor": 1.02,
    "eliteWeightBoostPerWave": 0.024,
    "maxEnemiesPerWave": 68
  }
} as unknown as BalanceConfig;
