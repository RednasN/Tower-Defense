import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Cell } from '../../models/grid/grid';
import { BuildTowerDialogComponent } from '../build-tower-dialog/build-tower-dialog.component';
import { CanvasService } from '../../services/game/canvas.service';
import { GridService } from '../../services/game/grid.service';
import { TowerService } from '../../services/towers/tower.service';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-canvas.component.html',
})
export class GameCanvasComponent implements OnInit {
  title = 'TowerDefense';
  private readonly doubleTapThresholdMs = 300;
  private lastTapTimestamp = 0;
  private lastTapCell: Cell | null = null;

  private readonly canvasService = inject(CanvasService);
  private readonly gridService = inject(GridService);
  private readonly towerService = inject(TowerService);
  private readonly dialog = inject(MatDialog);

  public ngOnInit(): void {
    this.canvasService.initialize();

    this.addTouchStartListener();
    this.addTouchMoveListener();
    this.addMouseDownListener();
  }

  @HostListener('window:resize', ['$event'])
  public onResize(): void {
    this.canvasService.calculateSize();
  }

  private addTouchStartListener(): void {
    this.canvasService.mainCanvas.addEventListener('touchstart', e => {
      this.canvasService.mainCanvasYCurrent = e.targetTouches[0].pageY / this.canvasService.scaleToFit;
      this.canvasService.mainCanvasXCurrent = e.targetTouches[0].pageX / this.canvasService.scaleToFit;

      this.handleSelection();
    });
  }

  private addTouchMoveListener(): void {
    this.canvasService.mainCanvas.addEventListener('touchmove', e => {
      this.canvasService.move(e.targetTouches[0].pageX, e.targetTouches[0].pageY);

      e.preventDefault();
    });
  }

  private addMouseDownListener(): void {
    this.canvasService.mainCanvas.addEventListener('mousedown', e => {
      this.canvasService.mainCanvasYCurrent = e.pageY / this.canvasService.scaleToFit;
      this.canvasService.mainCanvasXCurrent = e.pageX / this.canvasService.scaleToFit;
      this.handleSelection();
    });
  }

  private getClickedCell(): Cell | null {
    for (const row of this.gridService.grid) {
      for (const cell of row) {
        const startx = cell.drawx + this.canvasService.mainCanvasXOffset;
        const starty = cell.drawy + this.canvasService.mainCanvasYOffset;

        if (
          this.canvasService.mainCanvasXCurrent > startx &&
          this.canvasService.mainCanvasXCurrent < startx + cell.width &&
          this.canvasService.mainCanvasYCurrent > starty &&
          this.canvasService.mainCanvasYCurrent < starty + cell.height
        ) {
          return cell;
        }
      }
    }
    return null;
  }

  private isDoubleTapOnSameCell(cell: Cell): boolean {
    if (!this.lastTapCell) {
      return false;
    }

    const isSameCell = this.lastTapCell.x === cell.x && this.lastTapCell.y === cell.y;
    const isWithinThreshold = Date.now() - this.lastTapTimestamp <= this.doubleTapThresholdMs;
    return isSameCell && isWithinThreshold;
  }

  private handleSelection(): void {
    const clickedCell = this.getClickedCell();
    this.gridService.selectedCell = clickedCell;

    if (clickedCell) {
      this.towerService.selectWeaponAtCell(clickedCell.x, clickedCell.y);

      if (this.towerService.getSelectedWeapon() && this.isDoubleTapOnSameCell(clickedCell)) {
        this.openTowerUpgradeDialog();
        this.lastTapCell = null;
        this.lastTapTimestamp = 0;
        return;
      }

      this.lastTapCell = clickedCell;
      this.lastTapTimestamp = Date.now();
      return;
    }

    this.towerService.clearSelectedWeapon();
    this.lastTapCell = null;
    this.lastTapTimestamp = 0;
  }

  private openTowerUpgradeDialog(): void {
    if (this.dialog.openDialogs.length > 0) {
      return;
    }

    const selectedWeapon = this.towerService.getSelectedWeapon();
    if (!selectedWeapon) {
      return;
    }

    this.dialog.open(BuildTowerDialogComponent, {
      panelClass: 'create-tower-dialog',
      data: {
        mode: 'upgrade',
        selectedWeapon,
      },
    });
  }
}
