import { Injectable, inject } from '@angular/core';

import {
  Weapon,
  WeaponType,
  isBulletShooter,
  isGrenadeThrower,
  isLaserTurret,
  isNucleareLauncher,
  isRocketLauncher,
  isSlowRocketLauncher,
} from '../../models/weapons/weapon.model';
import { CanvasService } from '../game/canvas.service';
import { GridService } from '../game/grid.service';
import { ImageService } from '../game/image.service';

import { BasicTurretService } from './basic-turret.service';
import { GrenadeThrowerService } from './grenade-thrower.service';
import { LaserTurretService } from './laser-turret.service';
import { NuclearLauncherService } from './nuclear-launcher.service';
import { RocketLauncherService } from './rocket-launcher.service';
import { SlowRocketLauncherService } from './slow-rocket-launcher.service';
import { TurretConfigService } from './turret-config.service';

@Injectable({
  providedIn: 'root',
})
export class TowerService {
  private readonly canvasService = inject(CanvasService);
  private readonly gridService = inject(GridService);
  private readonly imageService = inject(ImageService);

  private readonly basicTurretService = inject(BasicTurretService);
  private readonly rocketLauncherService = inject(RocketLauncherService);
  private readonly laserTurretService = inject(LaserTurretService);
  private readonly slowRocketLauncherService = inject(SlowRocketLauncherService);
  private readonly nuclearlauncherService = inject(NuclearLauncherService);
  private readonly grenadeThrowerService = inject(GrenadeThrowerService);
  private readonly turretConfigService = inject(TurretConfigService);

  private weapons: Weapon[] = [];
  private selectedWeapon: Weapon | null = null;

  public calculate(): void {
    this.weapons.forEach(weapon => {
      if (isRocketLauncher(weapon)) {
        this.rocketLauncherService.calculate(weapon);
      } else if (isBulletShooter(weapon)) {
        this.basicTurretService.calculate(weapon);
      } else if (isLaserTurret(weapon)) {
        this.laserTurretService.calculate(weapon);
      } else if (isNucleareLauncher(weapon)) {
        this.nuclearlauncherService.calculate(weapon);
      } else if (isSlowRocketLauncher(weapon)) {
        this.slowRocketLauncherService.calculate(weapon);
      } else if (isGrenadeThrower(weapon)) {
        this.grenadeThrowerService.calculate(weapon);
      }
    });
  }

  public draw(): void {
    if (this.selectedWeapon && !this.weapons.includes(this.selectedWeapon)) {
      this.selectedWeapon = null;
    }

    this.weapons.forEach(weapon => {
      try {
        const towerFrames = this.imageService.towers[weapon.type];
        const towerFrame = this.imageService.getRotationFrame(towerFrames, weapon.angle);
        this.canvasService.draw(towerFrame, weapon.startx!, weapon.starty!);
      } catch (err) {
        console.log('Error!', err);
      }
    });

    if (!this.selectedWeapon) {
      return;
    }

    const selectedCell = this.gridService.grid[this.selectedWeapon.gridX][this.selectedWeapon.gridY];
    if (!selectedCell) {
      this.selectedWeapon = null;
      return;
    }

    const centerX = selectedCell.drawx + this.canvasService.mainCanvasXOffset + selectedCell.width / 2;
    const centerY = selectedCell.drawy + this.canvasService.mainCanvasYOffset + selectedCell.height / 2;
    this.canvasService.fillCircle(centerX, centerY, this.selectedWeapon.range, 'rgba(127, 201, 255, 0.18)');
  }

  public selectWeaponAtCell(x: number, y: number): void {
    const matchingWeapon = this.getWeaponAtCell(x, y);
    this.selectedWeapon = matchingWeapon ?? null;
  }

  public clearSelectedWeapon(): void {
    this.selectedWeapon = null;
  }

  public getSelectedWeapon(): Weapon | null {
    return this.selectedWeapon;
  }

  public getWeaponAtCell(x: number, y: number): Weapon | null {
    return this.weapons.find(weapon => weapon.gridX === x && weapon.gridY === y) ?? null;
  }

  public getWeapons(): readonly Weapon[] {
    return this.weapons;
  }

  public upgradeTower(weapon: Weapon, levels: { speedLevel: number; powerLevel: number; rangeLevel: number }): void {
    const existingWeapon = this.weapons.find(w => w === weapon);
    if (!existingWeapon) {
      return;
    }

    existingWeapon.speedLevel = levels.speedLevel;
    existingWeapon.powerLevel = levels.powerLevel;
    existingWeapon.rangeLevel = levels.rangeLevel;
    this.applyWeaponStats(existingWeapon);
  }

  public createTower(type: WeaponType, x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    switch (type) {
      case WeaponType.BulletShooter:
        this.createBulletShooter(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      case WeaponType.RocketLauncher:
        this.createRocketLauncher(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      case WeaponType.LaserTurret:
        this.createLaserTurret(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      case WeaponType.NuclearLauncher:
        this.createNuclearLauncher(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      case WeaponType.SlowRocketLauncher:
        this.createSlowRocketLauncher(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      case WeaponType.GrenadeThrower:
        this.createGrenadeThrower(x, y, speedLevel, powerLevel, rangeLevel);
        break;
      default:
        throw new Error('Invalid turret type');
    }
  }

  private createBulletShooter(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const basicTurret = this.basicTurretService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(basicTurret);
    this.weapons.push(basicTurret);
  }

  private createNuclearLauncher(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const nuclearlauncher = this.nuclearlauncherService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(nuclearlauncher);
    this.weapons.push(nuclearlauncher);
  }

  private createRocketLauncher(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const rocketLauncher = this.rocketLauncherService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(rocketLauncher);
    this.weapons.push(rocketLauncher);
  }

  private createLaserTurret(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const laserTurret = this.laserTurretService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(laserTurret);
    this.weapons.push(laserTurret);
  }

  private createSlowRocketLauncher(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const laserTurret = this.slowRocketLauncherService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(laserTurret);
    this.weapons.push(laserTurret);
  }

  private createGrenadeThrower(x: number, y: number, speedLevel: number, powerLevel: number, rangeLevel: number): void {
    const grenadeThrower = this.grenadeThrowerService.create(x, y, speedLevel, powerLevel, rangeLevel);
    this.applyWeaponStats(grenadeThrower);
    this.weapons.push(grenadeThrower);
  }

  private applyWeaponStats(weapon: Weapon): void {
    const stats = this.turretConfigService.getTurretSpecification(weapon.type, weapon.speedLevel, weapon.rangeLevel, weapon.powerLevel);
    weapon.damage = stats.damage;
    weapon.speed = stats.speed;
    weapon.range = stats.range;
  }
}
