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

  public mainCanvas!: HTMLCanvasElement;
  public mainCtx!: CanvasRenderingContext2D;

  public scaleToFit = 1;

  public initialize(): void {
    this.mainCanvas = document.getElementById('towerDefenseView') as HTMLCanvasElement;
    this.mainCtx = this.mainCanvas.getContext('2d') as CanvasRenderingContext2D;

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

    this.mainCanvasYOffset = Math.floor(this.mainCanvasYOffset);
    this.mainCanvasXOffset = Math.floor(this.mainCanvasXOffset);
  }
}
