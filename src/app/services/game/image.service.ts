import { Injectable } from '@angular/core';

import { EnemyType } from '../../models/configs/turret-config.model';
import { RotateImage } from '../../models/image.model';
import { ProjectileType } from '../../models/projectiles/projectile-type.model';
import { WeaponType } from '../../models/weapons/weapon.model';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private readonly defaultRotationStep = 2;
  private readonly rotationCache = new Map<string, Promise<ImageBitmap[]>>();
  private readonly rotationStepByFrames = new WeakMap<ImageBitmap[], number>();

  public towers: Record<WeaponType, ImageBitmap[]> = {
    [WeaponType.Base]: [],
    [WeaponType.RocketLauncher]: [],
    [WeaponType.BulletShooter]: [],
    [WeaponType.FlameThrower]: [],
    [WeaponType.ChainLightningTower]: [],
    [WeaponType.NuclearLauncher]: [],
    [WeaponType.MultiRocketLauncher]: [],
    [WeaponType.LaserTurret]: [],
    [WeaponType.SlowRocketLauncher]: [],
    [WeaponType.GrenadeThrower]: [],
  };

  public bullets: Record<ProjectileType, ImageBitmap[]> = {
    [ProjectileType.Base]: [],
    [ProjectileType.Rocket]: [],
    [ProjectileType.Bullet]: [],
    [ProjectileType.FlameBubble]: [],
    [ProjectileType.Laser]: [],
    [ProjectileType.ChainLightning]: [],
    [ProjectileType.NuclearBullet]: [],
    [ProjectileType.SlowRocket]: [],
    [ProjectileType.GrenadeMine]: [],
  };

  public enemies: RotateImage[] = [];
  public explosions: RotateImage[] = [];

  public gridImages: ImageBitmap[] = [];
  public readonly gridImageSources: readonly string[] = gridImages;
  public imgSurrounder: ImageBitmap | null = null;
  public imgBlackTransparent: ImageBitmap | null = null;

  public async setupTowers(): Promise<void> {
    const towerConfigs = [
      { type: WeaponType.BulletShooter, path: './assets/turrets/turret.png' },
      { type: WeaponType.RocketLauncher, path: './assets/turrets/rocket-launcher-basic.png' },
      { type: WeaponType.FlameThrower, path: './assets/turrets/flame-thrower.png' },
      { type: WeaponType.ChainLightningTower, path: './assets/turrets/chain-lightning-tower.png' },
      { type: WeaponType.NuclearLauncher, path: './assets/turrets/nuclear-turret.png' },
      { type: WeaponType.MultiRocketLauncher, path: './assets/turrets/multi-rocket-launcher.png' },
      { type: WeaponType.LaserTurret, path: './assets/turrets/laser-shooter.png' },
      { type: WeaponType.SlowRocketLauncher, path: './assets/turrets/slow-turret.png' },
      { type: WeaponType.GrenadeThrower, path: './assets/turrets/grenade-thrower.png' },
    ];

    // Loop through each tower config and await image calculation
    for (const tower of towerConfigs) {
      console.log('Loading Tower: ', tower.type);

      const images = await this.calculateRotateImagesAsync(tower.path);
      this.towers[tower.type] = images;

      console.log('Finished loading Tower: ', tower.type);
    }

    console.log('Finished loading Towers');
  }

  public async setupEnemies(): Promise<void> {
    console.log('Loading Enemies');

    const enemyConfigs = [
      { type: EnemyType.Basic, name: 'BasicEnemy', path: 'assets/enemies/basic-enemy.png' },
      { type: EnemyType.FastAndWeak, name: 'FastAndWeakEnemy', path: 'assets/enemies/fast-weak-enemy.png' },
      { type: EnemyType.SlowAndStrong, name: 'SlowAndStrongEnemy', path: 'assets/enemies/slow-strong-enemy.png' },
      { type: EnemyType.Boss, name: 'BossEnemy', path: 'assets/enemies/boss-enemy.png' },
      { type: EnemyType.ScoutTank, name: 'ScoutTankEnemy', path: 'assets/enemies/scout-tank-enemy.png' },
      { type: EnemyType.SiegeTank, name: 'SiegeTankEnemy', path: 'assets/enemies/siege-tank-enemy.png' },
      { type: EnemyType.LightHovercraft, name: 'LightHovercraftEnemy', path: 'assets/enemies/light-hovercraft-enemy.png' },
      { type: EnemyType.HeavyHovercraft, name: 'HeavyHovercraftEnemy', path: 'assets/enemies/heavy-hovercraft-enemy.png' },
      { type: EnemyType.FighterPlane, name: 'FighterPlaneEnemy', path: 'assets/enemies/fighter-plane-enemy.png' },
      { type: EnemyType.BomberPlane, name: 'BomberPlaneEnemy', path: 'assets/enemies/bomber-plane-enemy.png' },
      { type: EnemyType.InterceptorDrone, name: 'InterceptorDroneEnemy', path: 'assets/enemies/fighter-plane-enemy.png' },
      { type: EnemyType.JuggernautMech, name: 'JuggernautMechEnemy', path: 'assets/enemies/siege-tank-enemy.png' },
    ];

    this.enemies = [];
    for (const enemy of enemyConfigs) {
      console.log('Loading Enemy: ', enemy.type);
      const images = await this.calculateRotateImagesAsyncWithFallback(enemy.path, 'assets/enemies/basic-enemy.png');
      this.enemies.push({ name: enemy.name, images });
      console.log('Finished loading Enemy: ', enemy.type);
    }

    console.log('Finished loading Enemies');
  }

  public async setupGridImages(): Promise<void> {
    for (const imageBase64 of gridImages) {
      const image = await this.setImageValue(imageBase64);
      this.gridImages.push(image);
    }

    console.log('Finished loading grid');
  }

  public async setupExplosions(): Promise<void> {
    await this.calculateSpriteAnimations('Explosion1', default_explosion_sheet, this.explosions, 50, 50);
    await this.calculateSpriteAnimations('Explosion2', nuclear_explosion_sheet, this.explosions, 50, 50);

    console.log('Finished loading explosions');
  }

  public async setupBullets(): Promise<void> {
    const bulletTypes = [
      { type: ProjectileType.Bullet, path: './assets/bullets/basic-bullet.png', width: 50, height: 50 },
      { type: ProjectileType.Rocket, path: './assets/bullets/basic-rocket.png', width: 50, height: 50 },
      { type: ProjectileType.NuclearBullet, path: './assets/bullets/nuclear-bullet-min.png', width: 50, height: 50 },
      { type: ProjectileType.Laser, path: './assets/bullets/laser-beam.png', width: 32, height: 32 },
      { type: ProjectileType.SlowRocket, path: './assets/bullets/big-rocket.png', width: 50, height: 50 },
    ];

    // Loop over bullet types and await each image calculation
    for (const bullet of bulletTypes) {
      console.log('Loading bullet: ', bullet.type);

      const images = await this.calculateRotateImagesAsync(bullet.path, bullet.width, bullet.height);
      this.bullets[bullet.type] = images;

      console.log('Finished loading bullet: ', bullet.type);
    }

    const grenadeMineBlack = await this.calculateImageWithFallback(
      'assets/bullets/grenade-mine-black.png',
      'assets/bullets/grenade-mine.png'
    );
    const grenadeMineRed = await this.calculateImageWithFallback('assets/bullets/grenade-mine-red.png', 'assets/bullets/grenade-mine.png');
    this.bullets[ProjectileType.GrenadeMine] = [grenadeMineBlack, grenadeMineRed];

    console.log('Finished loading bullets');
  }

  public async setupAssets(): Promise<void> {
    this.imgSurrounder = await this.calculateImage(imgBlackTransparentSrc);
    this.imgBlackTransparent = await this.calculateImage(imgSurrounderSrc);
  }

  public async setImageValue(imageBase64: string): Promise<ImageBitmap> {
    const response = await fetch(imageBase64);

    const imgBlob = await response.blob();
    const image = await createImageBitmap(imgBlob);

    return image;
  }

  public async calculateImage(imagesrc: string): Promise<ImageBitmap> {
    const response = await fetch(imagesrc);

    const imgBlob = await response.blob();
    const image = await createImageBitmap(imgBlob);

    const offscreenCanvas = new OffscreenCanvas(50, 50);
    const imageCtx = offscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    imageCtx.clearRect(0, 0, 50, 50);
    imageCtx.save();
    imageCtx.drawImage(image, 0, 0, 50, 50);
    imageCtx.restore();

    const newImageBitMap = await createImageBitmap(offscreenCanvas);

    return newImageBitMap;
  }

  private async calculateImageWithFallback(primarySrc: string, fallbackSrc: string): Promise<ImageBitmap> {
    try {
      return await this.calculateImage(primarySrc);
    } catch (err) {
      console.warn(`Failed to load image '${primarySrc}', falling back to '${fallbackSrc}'.`, err);
      return this.calculateImage(fallbackSrc);
    }
  }

  public async calculateSpriteAnimations(
    name: string,
    imagesrc: string,
    destination: RotateImage[],
    drawheight = 50,
    drawwidth = 50
  ): Promise<void> {
    const images: ImageBitmap[] = [];
    const source_sheet = new Image();

    const offscreenCanvas = new OffscreenCanvas(drawheight, drawwidth);
    const imageCtx = offscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    if (!imageCtx) {
      throw new Error('Canvas context or canvas is not initialized.');
    }

    await new Promise<void>((resolve, reject) => {
      source_sheet.onload = async function () {
        const clippedImages = source_sheet.width / drawwidth;

        for (let i = 1; i < clippedImages; i++) {
          imageCtx.clearRect(0, 0, 50, 50);
          imageCtx.save();
          imageCtx.drawImage(source_sheet, drawwidth * i, 0, 50, 50, 0, 0, drawwidth, drawheight);
          imageCtx.restore();

          const imageBitmap = await createImageBitmap(offscreenCanvas);
          images.push(imageBitmap);
        }
        resolve();
      };

      source_sheet.src = imagesrc;
      source_sheet.onerror = err => reject(err);
    });

    const item = {
      name: name,
      images: images,
    };
    destination.push(item);
  }

  public async calculateRotateImagesAsync(
    imagesrc: string,
    drawheight = 50,
    drawwidth = 50,
    rotationStep = this.defaultRotationStep
  ): Promise<ImageBitmap[]> {
    const normalizedStep = this.normalizeRotationStep(rotationStep);
    const cacheKey = `${imagesrc}|${drawheight}|${drawwidth}|${normalizedStep}`;
    const cachedRotations = this.rotationCache.get(cacheKey);
    if (cachedRotations) {
      return cachedRotations;
    }

    const pendingRotations = this.generateRotations(imagesrc, drawheight, drawwidth, normalizedStep);
    this.rotationCache.set(cacheKey, pendingRotations);

    try {
      const rotations = await pendingRotations;
      this.rotationStepByFrames.set(rotations, normalizedStep);
      return rotations;
    } catch (err) {
      this.rotationCache.delete(cacheKey);
      throw err;
    }
  }

  private async generateRotations(imagesrc: string, drawheight: number, drawwidth: number, rotationStep: number): Promise<ImageBitmap[]> {
    const response = await fetch(imagesrc);
    const imgBlob = await response.blob();
    const image = await createImageBitmap(imgBlob);

    const offscreen = new OffscreenCanvas(drawwidth, drawheight);

    const ctx = offscreen.getContext('2d', { willReadFrequently: true });

    if (!ctx) throw new Error('Could not get OffscreenCanvas 2D context');

    const rotatedFrames: ImageBitmap[] = [];
    for (let i = 0; i < 360; i += rotationStep) {
      ctx.clearRect(0, 0, drawwidth, drawheight);
      ctx.translate(drawwidth / 2, drawheight / 2);
      ctx.rotate((i * Math.PI) / 180);
      ctx.drawImage(image, -drawwidth / 2, -drawheight / 2, drawwidth, drawheight);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

      rotatedFrames.push(await createImageBitmap(offscreen));
    }

    return rotatedFrames;
  }

  private async calculateRotateImagesAsyncWithFallback(primarySrc: string, fallbackSrc: string): Promise<ImageBitmap[]> {
    try {
      return await this.calculateRotateImagesAsync(primarySrc);
    } catch (err) {
      console.warn(`Failed to load image '${primarySrc}', falling back to '${fallbackSrc}'.`, err);
      return this.calculateRotateImagesAsync(fallbackSrc);
    }
  }

  private normalizeRotationStep(rotationStep: number): number {
    if (!Number.isFinite(rotationStep)) {
      return this.defaultRotationStep;
    }

    const roundedStep = Math.round(rotationStep);
    if (roundedStep <= 0) {
      return this.defaultRotationStep;
    }

    return roundedStep > 360 ? 360 : roundedStep;
  }

  public getRotationFrame(images: ImageBitmap[], angle: number): ImageBitmap {
    if (images.length === 0) {
      throw new Error('Rotation frame collection is empty.');
    }

    const rotationStep = this.rotationStepByFrames.get(images) ?? 1;
    const normalizedAngle = ((Math.round(angle) % 360) + 360) % 360;
    const frameIndex = Math.round(normalizedAngle / rotationStep) % images.length;
    return images[frameIndex];
  }
}

const imgSurrounderSrc =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAA2klEQVRoQ+2aywrCMBBFbygogj/kzk935w8JolAiXQRKfUAwY2/kdJNdyeSeOVlMUpbyfZQ2g9Tzmm6jcu9FTPtPJGKG41Mix6t02knu67IdXvaIexFlf/NiSMQBv6pEtoOSDL7DRXl+eNU9ct57FDLdd8veJZE1CSOR0lj0SGMOsVZRHfdIY7SwFtZqjFT5HdbCWkFoYS2sFYQW1sJaQWhhLawVhBbWwlpBaGEtrBWEFtbCWkFofW0t18Fo9cTKYVb47jCrJlYk8oNHBx8T6fWBDa+D3JL7m0Qe7HvOOT05TSIAAAAASUVORK5CYII=';
const imgBlackTransparentSrc =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAABbUlEQVR4Xu3VQQkAMBDEwK1/BXVbqIp55BSEhOXOtruOMXAKwrT4IAWxehQE61GQgmgGMJ5+SEEwAxhOCykIZgDDaSEFwQxgOC2kIJgBDKeFFAQzgOG0kIJgBjCcFlIQzACG00IKghnAcFpIQTADGE4LKQhmAMNpIQXBDGA4LaQgmAEMp4UUBDOA4bSQgmAGMJwWUhDMAIbTQgqCGcBwWkhBMAMYTgspCGYAw2khBcEMYDgtpCCYAQynhRQEM4DhtJCCYAYwnBZSEMwAhtNCCoIZwHBaSEEwAxhOCykIZgDDaSEFwQxgOC2kIJgBDKeFFAQzgOG0kIJgBjCcFlIQzACG00IKghnAcFpIQTADGE4LKQhmAMNpIQXBDGA4LaQgmAEMp4UUBDOA4bSQgmAGMJwWUhDMAIbTQgqCGcBwWkhBMAMYTgspCGYAw2khBcEMYDgtpCCYAQynhRQEM4DhtJCCYAYwnBZSEMwAhvMAVpE8KbTb+00AAAAASUVORK5CYII=';

const gridImages: string[] = [
  './assets/levels/tile-00.png',
  './assets/levels/tile-01.png',
  './assets/levels/tile-02.png',
  './assets/levels/tile-03.png',
  './assets/levels/tile-04.png',
  './assets/levels/tile-05.png',
  './assets/levels/tile-06.png',
  './assets/levels/tile-07.png',
  './assets/levels/tile-08.png',
  './assets/levels/tile-09.png',
  './assets/levels/tile-10.png',
  './assets/levels/tile-11.png',
  './assets/levels/tile-12.png',
  './assets/levels/tile-13.png',
  './assets/levels/tile-14.png',
  './assets/levels/tile-15.png',
  './assets/levels/tile-16.png',
  './assets/levels/tile-17.png',
  './assets/levels/tile-18.png',
  './assets/levels/tile-19.png',
  './assets/levels/tile-20.png',
  './assets/levels/tile-21.png',
  './assets/levels/tile-22.png',
  './assets/levels/tile-23.png',
  './assets/levels/tile-24.png',
  './assets/levels/tile-25.png',
  './assets/levels/tile-26.png',
  './assets/levels/tile-27.png',
  './assets/levels/tile-28.png',
  './assets/levels/tile-29.png',
  './assets/levels/tile-30.png',
  './assets/levels/tile-31.png',
];

const default_explosion_sheet =
  'data:image/png;base64,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';
const nuclear_explosion_sheet =
  'data:image/png;base64,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';
