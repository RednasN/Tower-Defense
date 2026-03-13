/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Injectable } from '@angular/core';

import {
  TurretConfig,
  UpgradeType,
  getTurretConfigs,
} from '../../models/configs/turret-config.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { WeaponType } from '../../models/weapons/weapon.model';

export type TurretSpecification = {
  damage: number;
  range: number;
  speed: number;
  projectileType: ProjectileType;
  projectileSpeed: number | null;
};

@Injectable({
  providedIn: 'root',
})
export class TurretConfigService {
  private readonly turretConfigs: TurretConfig[] = [];

  constructor() {
    this.turretConfigs.push(...getTurretConfigs());
  }

  public getTurretSpecification(turretType: WeaponType, speedLevel: number, rangeLevel: number, damageLevel: number): TurretSpecification {
    const turretConfig = this.getTurretConfig(turretType);

    return {
      damage: this.getLevelValueForTurretConfig(turretConfig, UpgradeType.Damage, damageLevel),
      range: this.getLevelValueForTurretConfig(turretConfig, UpgradeType.Range, rangeLevel),
      speed: this.getLevelValueForTurretConfig(turretConfig, UpgradeType.Speed, speedLevel),
      projectileType: turretConfig.projectileType,
      projectileSpeed: turretConfig.projectileSpeed,
    };
  }

  public getTurretConfig(turretType: WeaponType): TurretConfig {
    const turretConfig = this.turretConfigs.find(config => config.type === turretType);
    if (!turretConfig) {
      throw new Error(`Missing turret config for type ${turretType}`);
    }

    return turretConfig;
  }

  private getLevelValueForTurretConfig(turretConfig: TurretConfig, upgradeType: UpgradeType, level: number): number {
    return turretConfig.upgrades.find(upgrade => upgrade.type === upgradeType)!.details.find(x => x.level == level)!.value;
  }
}
