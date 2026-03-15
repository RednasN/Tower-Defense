import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Observable, map } from 'rxjs';

import { BuildTowerDialogComponent } from './components/build-tower-dialog/build-tower-dialog.component';
import { GameCanvasComponent } from './components/game-canvas/game-canvas.component';
import { LevelBuilderComponent } from './components/level-builder/level-builder.component';
import { EnemyType } from './models/configs/turret-config.model';
import { AiPlayService } from './services/game/ai-play.service';
import { CanvasService } from './services/game/canvas.service';
import { GameLoopService } from './services/game/game-loop.service';
import { GameStateService } from './services/game/game-state.service';
import { GridService } from './services/game/grid.service';
import { ImageService } from './services/game/image.service';
import { WaveService } from './services/game/wave.service';
import { TowerService } from './services/towers/tower.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameCanvasComponent, LevelBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'TowerDefense';

  private readonly imageService = inject(ImageService);
  private readonly gridService = inject(GridService);
  private readonly gameLoopService = inject(GameLoopService);
  private readonly waveService = inject(WaveService);
  private readonly towerService = inject(TowerService);
  private readonly canvasService = inject(CanvasService);
  private readonly aiPlayService = inject(AiPlayService);
  private readonly dialog = inject(MatDialog);

  private readonly gameState = inject(GameStateService);
  public readonly waveLabel$ = this.waveService.waveState$.pipe(map(state => Math.max(1, state.waveNumber).toString().padStart(3, '0')));
  public readonly nextWaveCountdown$ = this.waveService.waveState$.pipe(map(state => Math.ceil(state.timeUntilNextWaveMs / 1000)));
  public readonly aiPlayEnabled$ = this.aiPlayService.isEnabled$;
  public isMenuOpen = false;
  public isLevelBuilderOpen = false;

  public ngOnInit(): void {
    this.imageService
      .setupTowers()
      .then(() => this.imageService.setupEnemies())
      .then(() => this.imageService.setupBullets())
      .then(() => this.imageService.setupAssets())
      .then(() => this.imageService.setupGridImages())
      .then(() => this.imageService.setupExplosions())
      .then(() => {
        this.gridService.setupLevelOne();
        this.registerWorldSize();
        this.waveService.initialize();
        this.waveService.setEnemyEscapedHandler(event => {
          const damage = this.getBaseDamageForEnemyType(event.enemyType);
          this.gameState.damageBase(damage);
          if (this.gameState.getBaseHealth() === 0 && !this.gameLoopService.paused) {
            this.gameLoopService.changePause();
          }
        });

        console.log('Images loaded');
        this.gameLoopService.start();
      });
  }

  public togglePause(): void {
    this.gameLoopService.changePause();
  }

  public changeSpeed(): void {
    this.gameLoopService.changeSpeed();
  }

  public startNextWave(): void {
    this.waveService.startWaveEarly();
  }

  public changeZoom(): void {
    this.canvasService.changeZoom();
  }

  public get speed(): number {
    return this.gameLoopService.speed;
  }

  public get paused(): boolean {
    return this.gameLoopService.paused;
  }

  public get zoomLevel(): number {
    return this.canvasService.zoomLevel;
  }

  public get money$(): Observable<number> {
    return this.gameState.moneyChanged$;
  }

  public get baseHealth$(): Observable<number> {
    return this.gameState.baseHealthChanged$;
  }

  public buildTower(): void {
    const selectedCell = this.gridService.selectedCell;
    const selectedWeapon = selectedCell ? this.towerService.getWeaponAtCell(selectedCell.x, selectedCell.y) : null;

    if (selectedWeapon) {
      this.dialog.open(BuildTowerDialogComponent, {
        panelClass: 'create-tower-dialog',
        data: {
          mode: 'upgrade',
          selectedWeapon,
        },
      });
      return;
    }

    this.dialog.open(BuildTowerDialogComponent, {
      panelClass: 'create-tower-dialog',
    });
  }

  public toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  public closeMenu(): void {
    this.isMenuOpen = false;
  }

  public openLevelBuilder(): void {
    this.aiPlayService.setBlocked(true, 'level-builder');
    this.isLevelBuilderOpen = true;
    this.isMenuOpen = false;
  }

  public closeLevelBuilder(): void {
    this.isLevelBuilderOpen = false;
    this.aiPlayService.setBlocked(false);
  }

  public toggleAiPlay(): void {
    if (this.isLevelBuilderOpen) {
      return;
    }

    this.aiPlayService.toggle();
    this.isMenuOpen = false;
  }

  public isAiPlayEnabled(): boolean {
    return this.aiPlayService.isEnabled();
  }

  private registerWorldSize(): void {
    const grid = this.gridService.grid;
    const gridWidth = grid.length;
    const gridHeight = grid[0]?.length ?? 0;
    const cellWidth = grid[0]?.[0]?.width ?? 50;
    const cellHeight = grid[0]?.[0]?.height ?? 50;

    this.canvasService.setWorldSize(gridWidth * cellWidth, gridHeight * cellHeight);
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
      case EnemyType.InterceptorDrone:
      case EnemyType.Boss:
        return 3;
      case EnemyType.JuggernautMech:
        return 4;
      default:
        return 1;
    }
  }
}
