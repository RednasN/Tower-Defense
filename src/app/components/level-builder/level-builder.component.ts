import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Cell } from '../../models/grid/grid';
import { ImageService } from '../../services/game/image.service';

type BuilderCell = {
  x: number;
  y: number;
  imageIndex: number | null;
};

type RouteCell = {
  x: number;
  y: number;
};

@Component({
  selector: 'app-level-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-builder.component.html',
  styleUrl: './level-builder.component.scss',
})
export class LevelBuilderComponent {
  @Output() closeBuilder = new EventEmitter<void>();

  private readonly tileSize = 50;
  private readonly imageService = inject(ImageService);

  public gridWidth = 15;
  public gridHeight = 15;
  public selectedTileIndex = 0;
  public routeMode = false;

  public readonly tileSources = this.imageService.gridImageSources;
  public cells: BuilderCell[][] = [];
  public rowIndexes: number[] = [];
  public columnIndexes: number[] = [];
  public route: RouteCell[] = [];

  public readonly trackByIndex = (index: number): number => index;

  private routeStepByCell = new Map<string, number>();

  constructor() {
    this.createGrid();
  }

  public createGrid(): void {
    this.gridWidth = Math.max(1, Math.floor(this.gridWidth));
    this.gridHeight = Math.max(1, Math.floor(this.gridHeight));

    this.cells = [];

    for (let x = 0; x < this.gridWidth; x++) {
      const column: BuilderCell[] = [];
      for (let y = 0; y < this.gridHeight; y++) {
        column.push({
          x,
          y,
          imageIndex: this.selectedTileIndex,
        });
      }
      this.cells.push(column);
    }

    this.columnIndexes = Array.from({ length: this.gridWidth }, (_, index) => index);
    this.rowIndexes = Array.from({ length: this.gridHeight }, (_, index) => index);

    this.clearRoute();
  }

  public clearGridTiles(): void {
    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        this.cells[x][y].imageIndex = this.selectedTileIndex;
      }
    }
  }

  public clearRoute(): void {
    this.route = [];
    this.routeStepByCell.clear();
  }

  public onCellClick(x: number, y: number): void {
    if (!this.cells[x] || !this.cells[x][y]) {
      return;
    }

    if (this.routeMode) {
      this.updateRoute(x, y);
      return;
    }

    this.cells[x][y].imageIndex = this.selectedTileIndex;
  }

  public getCellTileSource(x: number, y: number): string {
    const imageIndex = this.cells[x]?.[y]?.imageIndex ?? 0;
    return this.tileSources[imageIndex] ?? this.tileSources[0];
  }

  public isRouteCell(x: number, y: number): boolean {
    return this.routeStepByCell.has(this.getRouteKey(x, y));
  }

  public getRouteStep(x: number, y: number): number | null {
    return this.routeStepByCell.get(this.getRouteKey(x, y)) ?? null;
  }

  public save(): void {
    const fixedGrid = this.buildFixedGrid();
    const fixedRoute = this.buildFixedRoute();

    const fixedGridJson = JSON.stringify(fixedGrid);
    const fixedRouteJson = JSON.stringify(fixedRoute);

    console.log('fixedGrid object:', fixedGrid);
    console.log('fixedRoute object:', fixedRoute);
    console.log(`const fixedRoute = JSON.parse('${fixedRouteJson}') as Cell[];`);
    console.log(`const fixedGrid = JSON.parse('${fixedGridJson}') as Cell[][];`);
  }

  public close(): void {
    this.closeBuilder.emit();
  }

  private updateRoute(x: number, y: number): void {
    const routeKey = this.getRouteKey(x, y);
    const existingStep = this.routeStepByCell.get(routeKey);

    if (existingStep === undefined) {
      this.route.push({ x, y });
      this.routeStepByCell.set(routeKey, this.route.length);
      return;
    }

    if (existingStep === this.route.length) {
      this.route.pop();
      this.routeStepByCell.delete(routeKey);
    }
  }

  private buildFixedGrid(): Cell[][] {
    const fixedGrid: Cell[][] = [];

    for (let x = 0; x < this.gridWidth; x++) {
      const column: Cell[] = [];
      for (let y = 0; y < this.gridHeight; y++) {
        column.push(this.toCell(x, y, this.cells[x][y].imageIndex));
      }
      fixedGrid.push(column);
    }

    return fixedGrid;
  }

  private buildFixedRoute(): Cell[] {
    return this.route.map(routeCell => {
      const { x, y } = routeCell;
      const imageIndex = this.cells[x]?.[y]?.imageIndex ?? null;
      return this.toCell(x, y, imageIndex);
    });
  }

  private toCell(x: number, y: number, imageIndex: number | null): Cell {
    return {
      x,
      y,
      drawx: x * this.tileSize,
      drawy: y * this.tileSize,
      width: this.tileSize,
      height: this.tileSize,
      imageIndex,
      steps: 0,
      done: false,
      parentcell: null,
      placeHolder: null,
      cellcolor: 'grey',
    };
  }

  private getRouteKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
