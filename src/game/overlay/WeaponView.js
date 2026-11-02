import { Assets, Container, Sprite } from 'pixi.js';

/**
 * Screen-space first-person weapon rendered in PixiJS.
 */
export class WeaponView {
  constructor(stage, weaponDef) {
    this.stage = stage;
    this.def = weaponDef;
    this.view = weaponDef.view;
    this.root = new Container();
    this.weaponSprite = null;
    this.muzzleSprite = null;
    this.textures = new Map();
    this.state = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.recoil = 0;
    this.muzzleTimer = 0;
    this.viewport = { width: 1, height: 1 };
    stage.addChild(this.root);
  }

  static async create(stage, weaponDef) {
    const view = new WeaponView(stage, weaponDef);
    await view.load();
    return view;
  }

  async load() {
    const sheet = await Assets.load(this.view.spritesheet);
    const textures = sheet.textures ?? sheet;
    for (const name of [
      ...this.view.idleFrames,
      ...this.view.fireFrames,
      this.view.muzzleFlash.frame,
    ]) {
      const tex = textures[name];
      if (!tex) throw new Error(`Missing weapon frame: ${name}`);
      this.textures.set(name, tex);
    }

    this.weaponSprite = new Sprite(this.textures.get(this.view.idleFrames[0]));
    this.weaponSprite.anchor.set(this.view.anchor[0], this.view.anchor[1]);
    this.root.addChild(this.weaponSprite);

    this.muzzleSprite = new Sprite(this.textures.get(this.view.muzzleFlash.frame));
    this.muzzleSprite.anchor.set(0.5, 0.5);
    this.muzzleSprite.visible = false;
    this.root.addChild(this.muzzleSprite);

    this.layout();
  }

  layout(width, height) {
    if (width && height) {
      this.viewport.width = width;
      this.viewport.height = height;
    }
    const w = this.viewport.width;
    const h = this.viewport.height;
    const [ox, oy] = this.view.screenOffset;
    const refH = this.view.refHeight ?? 900;
    const scale = this.view.baseScale * (h / refH);

    this.root.x = w * (1 - ox);
    this.root.y = h * (1 - oy) - this.recoil;
    this.root.scale.set(scale);
  }

  playFire() {
    this.state = 'firing';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.recoil = this.view.recoilPixels;
    this.muzzleTimer = this.view.muzzleFlash.duration;
    if (this.muzzleSprite) {
      const [mx, my] = this.view.muzzleFlash.offset ?? [-40, -100];
      this.muzzleSprite.position.set(mx, my);
      this.muzzleSprite.visible = true;
    }
    this.applyFrame(this.view.fireFrames[0]);
  }

  update(dt, viewport) {
    if (viewport) this.layout(viewport.width, viewport.height);

    const frameDur = 1 / Math.max(this.view.frameRate, 1);
    this.frameTimer += dt;

    if (this.state === 'idle') {
      if (this.frameTimer >= frameDur) {
        this.frameTimer = 0;
        this.frameIndex = (this.frameIndex + 1) % this.view.idleFrames.length;
        this.applyFrame(this.view.idleFrames[this.frameIndex]);
      }
    } else if (this.state === 'firing') {
      if (this.frameTimer >= frameDur) {
        this.frameTimer = 0;
        this.frameIndex += 1;
        if (this.frameIndex >= this.view.fireFrames.length) {
          this.state = 'idle';
          this.frameIndex = 0;
          this.applyFrame(this.view.idleFrames[0]);
        } else {
          this.applyFrame(this.view.fireFrames[this.frameIndex]);
        }
      }
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0 && this.muzzleSprite) {
        this.muzzleSprite.visible = false;
      }
    }

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - this.view.recoilRecover * dt * 60);
      this.layout();
    }
  }

  applyFrame(name) {
    const tex = this.textures.get(name);
    if (tex && this.weaponSprite) {
      this.weaponSprite.texture = tex;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
