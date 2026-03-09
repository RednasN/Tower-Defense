import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CanvasService {
  public mainCanvasXCurrent = 0;
  public mainCanvasYCurrent = 0;
  public mainCanvasXOffset = 0;
  public mainCanvasYOffset = 0;

  public drawScale = 1;
  public zoomLevel = 2;

  public mainCanvas!: HTMLCanvasElement;
  public mainCtx!: CanvasRenderingContext2D;

  public scaleToFit = 1;
  private readonly zoomScales = [0.75, 1, 1.25] as const;
  private worldWidth = 0;
  private worldHeight = 0;

  public initialize(): void {
    this.mainCanvas = document.getElementById('towerDefenseView') as HTMLCanvasElement;
    this.mainCtx = this.mainCanvas.getContext('2d') as CanvasRenderingContext2D;
    this.applyZoomScale();
    this.calculateSize();
  }

  public calculateSize(): void {
    const theWidth = document.documentElement.clientWidth;
    const theHeight = document.documentElement.clientHeight;

    this.mainCanvas.width = theWidth / this.drawScale;
    this.mainCanvas.height = theHeight / this.drawScale;

    const scaleX = theWidth / this.mainCanvas.width;
    const scaleY = theHeight / this.mainCanvas.height;

    this.scaleToFit = Math.max(scaleX, scaleY);

    this.mainCanvas.style.transformOrigin = '0 0';
    this.mainCanvas.style.transform = 'scale(' + this.scaleToFit + ')';
    this.clampOffsets();
  }

  public clear(): void {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    this.mainCtx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
  }

  public draw(image: ImageBitmap, x: number, y: number): void {
    if (image === null) {
      return;
    }
    this.mainCtx.drawImage(image, Math.floor(x), Math.floor(y));
  }

  public fillCircle(x: number, y: number, radius: number, fillStyle: string): void {
    this.mainCtx.save();
    this.mainCtx.fillStyle = fillStyle;
    this.mainCtx.beginPath();
    this.mainCtx.arc(x, y, radius, 0, Math.PI * 2);
    this.mainCtx.fill();
    this.mainCtx.restore();
  }

  public fillRect(x: number, y: number, width: number, height: number, fillStyle: string): void {
    this.mainCtx.save();
    this.mainCtx.fillStyle = fillStyle;
    this.mainCtx.fillRect(x, y, width, height);
    this.mainCtx.restore();
  }

  public move(x: number, y: number): void {
    const diffY = y / this.scaleToFit - this.mainCanvasYCurrent;
    this.mainCanvasYCurrent += diffY;
    this.mainCanvasYOffset += diffY;

    const diffX = x / this.scaleToFit - this.mainCanvasXCurrent;
    this.mainCanvasXCurrent += diffX;
    this.mainCanvasXOffset += diffX;

    this.clampOffsets();
  }

  public changeZoom(): void {
    this.zoomLevel = this.zoomLevel !== 3 ? this.zoomLevel + 1 : 1;
    this.applyZoomScale();
    this.calculateSize();
  }

  public setWorldSize(width: number, height: number): void {
    this.worldWidth = Math.max(0, width);
    this.worldHeight = Math.max(0, height);

    if (this.mainCanvas) {
      this.clampOffsets();
    }
  }

  private applyZoomScale(): void {
    this.drawScale = this.zoomScales[this.zoomLevel - 1];
  }

  private clampOffsets(): void {
    if (!this.mainCanvas || this.worldWidth <= 0 || this.worldHeight <= 0) {
      return;
    }

    const viewWidth = this.mainCanvas.width;
    const viewHeight = this.mainCanvas.height;

    if (this.worldWidth <= viewWidth) {
      this.mainCanvasXOffset = Math.floor((viewWidth - this.worldWidth) / 2);
    } else {
      const minX = viewWidth - this.worldWidth;
      this.mainCanvasXOffset = Math.min(0, Math.max(minX, this.mainCanvasXOffset));
      this.mainCanvasXOffset = Math.floor(this.mainCanvasXOffset);
    }

    if (this.worldHeight <= viewHeight) {
      this.mainCanvasYOffset = Math.floor((viewHeight - this.worldHeight) / 2);
    } else {
      const minY = viewHeight - this.worldHeight;
      this.mainCanvasYOffset = Math.min(0, Math.max(minY, this.mainCanvasYOffset));
      this.mainCanvasYOffset = Math.floor(this.mainCanvasYOffset);
    }
  }
}
