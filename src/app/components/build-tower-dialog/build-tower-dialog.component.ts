import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TurretConfig, UpgradeType, getTurretConfig, getTurretConfigs } from '../../models/configs/turret-config.model';
import { Weapon } from '../../models/weapons/weapon.model';
import { GridService } from '../../services/game/grid.service';
import { GameStateService } from '../../services/game/game-state.service';
import { TowerService } from '../../services/towers/tower.service';
import { ProgressionCircleComponent } from '../progression-circle/progression-circle.component';
import { canBuildTowerAtCell } from '../../simulation/placement';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type UpgradeDetails = {
  type: UpgradeType;
  icon: string;
  level: number;
  currentCost?: number;
  upgradeCost?: number;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Turret = TurretConfig & {
  selected: boolean;
};

export type BuildTowerDialogData = {
  mode?: 'build' | 'upgrade';
  selectedWeapon?: Weapon;
};

const DEFAULT_UPGRADE_OPTIONS = [
  { type: UpgradeType.Speed, icon: './assets/speed.png', level: 1 },
  { type: UpgradeType.Damage, icon: './assets/power.png', level: 1 },
  { type: UpgradeType.Range, icon: './assets/range.png', level: 1 },
];

@Component({
  selector: 'app-build-tower-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    ProgressionCircleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './build-tower-dialog.component.scss',
  templateUrl: './build-tower-dialog.component.html',
})
export class BuildTowerDialogComponent implements OnInit {
  private readonly towerService = inject(TowerService);
  private readonly gridService = inject(GridService);
  private readonly gameState = inject(GameStateService);
  private readonly dialogRef = inject(MatDialogRef<BuildTowerDialogComponent>);
  private readonly dialogData = inject<BuildTowerDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  public turrets: Turret[] = [];
  public totalCost: number | null = null;
  public upgradeOptions: UpgradeDetails[] = [];
  public readonly isUpgradeMode = this.dialogData?.mode === 'upgrade';
  private readonly selectedWeapon = this.dialogData?.selectedWeapon ?? null;

  public ngOnInit(): void {
    if (this.isUpgradeMode) {
      this.initializeUpgradeOptionsForSelectedWeapon();
      this.updateUpgradeOptions();
      return;
    }

    this.createTowerOptions();
    this.resetToDefaultUpgradeOptions();
  }

  public get canApply(): boolean {
    if (this.totalCost === null) {
      return false;
    }

    if (this.isUpgradeMode && !this.selectedWeapon) {
      return false;
    }

    if (!this.isUpgradeMode) {
      const selectedCell = this.gridService.selectedCell;
      if (!selectedCell || !canBuildTowerAtCell(selectedCell.x, selectedCell.y)) {
        return false;
      }
    }

    return this.gameState.getMoney() >= this.totalCost;
  }

  public get selectedTowerName(): string | null {
    if (this.isUpgradeMode) {
      return this.selectedWeapon ? this.formatTowerName(this.selectedWeapon.type) : null;
    }

    const selectedTurret = this.turrets.find(turret => turret.selected);
    return selectedTurret ? this.formatTowerName(selectedTurret.type) : null;
  }

  public upgrade(option: UpgradeDetails): void {
    if (option.level < 5) {
      option.level++;
      this.updateUpgradeOptions();
    }
  }

  public canUpgradeOption(option: UpgradeDetails): boolean {
    if (option.level >= 5 || option.upgradeCost === undefined) {
      return false;
    }

    const currentTotal = this.totalCost ?? 0;
    return this.gameState.getMoney() >= currentTotal + option.upgradeCost;
  }

  public selectTurret(turret: Turret): void {
    this.turrets.forEach(t => (t.selected = false));
    turret.selected = true;

    this.resetToDefaultUpgradeOptions();
    this.updateUpgradeOptions();
  }

  public cancel(): void {
    this.dialogRef.close();
  }

  public buildTower(): void {
    if (this.isUpgradeMode) {
      this.applyTowerUpgrade();
      return;
    }

    if (!this.canApply) {
      return;
    }

    const selectedTurret = this.turrets.find(turret => turret.selected);
    if (!selectedTurret) return;

    const selectedCell = this.gridService.selectedCell;
    if (!selectedCell) return;

    const upgradeLevels = this.upgradeOptions.reduce(
      (levels, option) => ({ ...levels, [option.type]: option.level }),
      {} as Record<UpgradeType, number>
    );

    this.towerService.createTower(
      selectedTurret.type,
      selectedCell.x,
      selectedCell.y,
      upgradeLevels[UpgradeType.Speed] ?? 1,
      upgradeLevels[UpgradeType.Damage] ?? 1,
      upgradeLevels[UpgradeType.Range] ?? 1
    );

    const totalCost = this.totalCost ?? 0;
    if (totalCost > 0) {
      this.gameState.spendMoney(totalCost);
    }

    this.dialogRef.close();
  }

  private createTowerOptions(): void {
    this.turrets = getTurretConfigs().map(turret => {
      return {
        ...turret,
        selected: false,
      };
    });
  }

  private calculateTotalCost(): void {
    if (this.isUpgradeMode) {
      this.totalCost = this.upgradeOptions.reduce((acc, option) => acc + (option.currentCost ?? 0), 0);
      return;
    }

    const towerCost = this.turrets.find(turret => turret.selected)?.cost;
    if (!towerCost) {
      this.totalCost = null;
      return;
    }

    const upgradeCosts = this.upgradeOptions.reduce((acc, option) => acc + option.currentCost!, 0);
    this.totalCost = upgradeCosts + towerCost!;
  }

  private updateUpgradeOptions(): void {
    const turretConfig = this.getActiveTurretConfig();
    if (!turretConfig) return;

    for (const upgradeType of [UpgradeType.Speed, UpgradeType.Damage, UpgradeType.Range]) {
      this.processUpgradeOption(upgradeType, turretConfig);
    }

    this.calculateTotalCost();
  }

  private processUpgradeOption(upgradeType: UpgradeType, turretConfig: TurretConfig): void {
    const currentStats = this.upgradeOptions.find(x => x.type === upgradeType);
    if (!currentStats) return;

    const upgradeConfig = turretConfig.upgrades.find(x => x.type === upgradeType);
    if (!upgradeConfig) return;

    const nextUpgrade = upgradeConfig.details.find(x => x.level === currentStats.level + 1);
    currentStats.upgradeCost = nextUpgrade?.cost;

    if (this.isUpgradeMode) {
      const currentLevel = this.getCurrentLevelForType(upgradeType);
      const incrementalUpgrades = upgradeConfig.details.filter(x => x.level > currentLevel && x.level <= currentStats.level);
      currentStats.currentCost = incrementalUpgrades.reduce((acc, x) => acc + x.cost, 0);
      return;
    }

    // Build mode starts at level 1 by default; only charge additional levels above 1.
    const currentUpgrades = upgradeConfig.details.filter(x => x.level > 1 && x.level <= currentStats.level);
    currentStats.currentCost = currentUpgrades.reduce((acc, x) => acc + x.cost, 0);
  }

  private resetToDefaultUpgradeOptions(): void {
    this.upgradeOptions = DEFAULT_UPGRADE_OPTIONS.map(option => ({ ...option }));
  }

  private initializeUpgradeOptionsForSelectedWeapon(): void {
    const selectedWeapon = this.selectedWeapon;
    if (!selectedWeapon) {
      this.resetToDefaultUpgradeOptions();
      return;
    }

    this.upgradeOptions = DEFAULT_UPGRADE_OPTIONS.map(option => {
      if (option.type === UpgradeType.Speed) {
        return { ...option, level: selectedWeapon.speedLevel };
      }

      if (option.type === UpgradeType.Damage) {
        return { ...option, level: selectedWeapon.powerLevel };
      }

      return { ...option, level: selectedWeapon.rangeLevel };
    });
  }

  private getActiveTurretConfig(): TurretConfig | null {
    if (this.isUpgradeMode) {
      if (!this.selectedWeapon) {
        return null;
      }

      return getTurretConfig(this.selectedWeapon.type);
    }

    const selectedTurret = this.turrets.find(x => x.selected);
    if (!selectedTurret) {
      return null;
    }

    return getTurretConfig(selectedTurret.type);
  }

  private getCurrentLevelForType(upgradeType: UpgradeType): number {
    if (!this.selectedWeapon) {
      return 1;
    }

    if (upgradeType === UpgradeType.Speed) {
      return this.selectedWeapon.speedLevel;
    }

    if (upgradeType === UpgradeType.Damage) {
      return this.selectedWeapon.powerLevel;
    }

    return this.selectedWeapon.rangeLevel;
  }

  private applyTowerUpgrade(): void {
    if (!this.selectedWeapon) {
      return;
    }

    const upgradeLevels = this.upgradeOptions.reduce(
      (levels, option) => ({ ...levels, [option.type]: option.level }),
      {} as Record<UpgradeType, number>
    );

    const nextSpeedLevel = upgradeLevels[UpgradeType.Speed] ?? this.selectedWeapon.speedLevel;
    const nextPowerLevel = upgradeLevels[UpgradeType.Damage] ?? this.selectedWeapon.powerLevel;
    const nextRangeLevel = upgradeLevels[UpgradeType.Range] ?? this.selectedWeapon.rangeLevel;

    if (
      nextSpeedLevel < this.selectedWeapon.speedLevel ||
      nextPowerLevel < this.selectedWeapon.powerLevel ||
      nextRangeLevel < this.selectedWeapon.rangeLevel
    ) {
      return;
    }

    if (!this.canApply) {
      return;
    }

    const totalCost = this.totalCost ?? 0;
    if (totalCost > 0) {
      this.gameState.spendMoney(totalCost);
    }

    this.towerService.upgradeTower(this.selectedWeapon, {
      speedLevel: nextSpeedLevel,
      powerLevel: nextPowerLevel,
      rangeLevel: nextRangeLevel,
    });

    this.dialogRef.close();
  }

  private formatTowerName(name: string): string {
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  }
}
