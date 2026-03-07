/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Injectable } from '@angular/core';

import {
  TurretConfig,
  UpgradeType,
  bulletShooterConfig,
  grenadeThrowerConfig,
  laserTurretConfig,
  nuclearLauncherConfig,
  rocketLauncherConfig,
  slowRocketLauncherConfig,
} from '../../models/configs/turret-config.model';
import { WeaponType } from '../../models/weapons/weapon.model';

export type TurretSpecification = {
  damage: number;
  range: number;
  speed: number;
};

@Injectable({
  providedIn: 'root',
})
export class TurretConfigService {
  private readonly turretConfigs: TurretConfig[] = [];

  constructor() {
    this.turretConfigs.push(rocketLauncherConfig);
    this.turretConfigs.push(bulletShooterConfig);
    this.turretConfigs.push(laserTurretConfig);
    this.turretConfigs.push(nuclearLauncherConfig);
    this.turretConfigs.push(slowRocketLauncherConfig);
    this.turretConfigs.push(grenadeThrowerConfig);
  }

  public getTurretSpecification(turretType: WeaponType, speedLevel: number, rangeLevel: number, damageLevel: number): TurretSpecification {
    const turretConfig = this.turretConfigs.find(turretConfig => turretConfig.type === turretType);

    return {
      damage: this.getLevelValueForTurretConfig(turretConfig!, UpgradeType.Damage, damageLevel),
      range: this.getLevelValueForTurretConfig(turretConfig!, UpgradeType.Range, rangeLevel),
      speed: this.getLevelValueForTurretConfig(turretConfig!, UpgradeType.Speed, speedLevel),
    };
  }

  private getLevelValueForTurretConfig(turretConfig: TurretConfig, upgradeType: UpgradeType, level: number): number {
    return turretConfig.upgrades.find(upgrade => upgrade.type === upgradeType)!.details.find(x => x.level == level)!.value;
  }
}
