import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Observable, map } from 'rxjs';

import { BuildTowerDialogComponent } from './components/build-tower-dialog/build-tower-dialog.component';
import { GameCanvasComponent } from './components/game-canvas/game-canvas.component';
import { LevelBuilderComponent } from './components/level-builder/level-builder.component';
import { GameLoopService } from './services/game/game-loop.service';
import { GameStateService } from './services/game/game-state.service';
import { GridService } from './services/game/grid.service';
import { ImageService } from './services/game/image.service';
import { TowerService } from './services/towers/tower.service';
import { WaveService } from './services/game/wave.service';

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
  private readonly dialog = inject(MatDialog);

  private readonly gameState = inject(GameStateService);
  public readonly waveLabel$ = this.waveService.waveState$.pipe(map(state => state.waveNumber.toString().padStart(3, '0')));
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
        this.waveService.initialize();
        this.waveService.setEnemyEscapedHandler(event => {
          console.log('Enemy escaped', event);
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

  public get speed(): number {
    return this.gameLoopService.speed;
  }

  public get paused(): boolean {
    return this.gameLoopService.paused;
  }

  public get money$(): Observable<number> {
    return this.gameState.moneyChanged$;
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
    this.isLevelBuilderOpen = true;
    this.isMenuOpen = false;
  }

  public closeLevelBuilder(): void {
    this.isLevelBuilderOpen = false;
  }
}
