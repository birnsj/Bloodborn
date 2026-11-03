import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { AnimPlayer } from '../animation/AnimPlayer.js';

/**
 * Screen-space first-person weapon rendered in PixiJS.
 * Supports multi-sheet even-grid atlases; walk/recoil clips; bob fallback.
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
    this.atlas = null;
    this.viewport = { width: 1, height: 1 };
    this.recoil = 0;
    this.muzzleTimer = 0;
    this.bobPhase = 0;
    this.swayPhase = 0;
    this.bobActive = false;
    this.shotsSinceReload = 0;
    this.reloadEvery = this.view.reloadEvery ?? 8;
    this._pendingReload = false;
    this.player = null;
    this._eventHandler = null;
    this._equipUnsub = null;
    this._hasWalkClip = false;
    stage.addChild(this.root);
  }

  static async create(stage, weaponDef) {
    const view = new WeaponView(stage, weaponDef);
    await view.load();
    return view;
  }

  async load() {
    const sheets = this.view.sheets?.length
      ? this.view.sheets
      : [{ id: 'default', spritesheet: this.view.spritesheet }];

    for (const sheet of sheets) {
      const jsonUrl = sheet.spritesheet;
      const atlas = await (await fetch(jsonUrl)).json();
      if (!this.atlas) this.atlas = atlas;
      if (atlas.cellWidth && atlas.columns) {
        await this.loadGridAtlas(jsonUrl, atlas);
      } else {
        await this.loadTexturePacker(jsonUrl);
      }
    }

    const clipsConfig = this.view.animations ?? this._legacyClips();
    this._hasWalkClip = Array.isArray(clipsConfig.walk?.frames) && clipsConfig.walk.frames.length > 0;

    const firstIdle = clipsConfig.idle?.frames?.[0] ?? [...this.textures.keys()][0];
    const anchor = this.view.anchor ?? this.atlas?.anchor ?? [0.62, 0.92];
    this._anchor = anchor;

    const idleTex = this.textures.get(firstIdle);
    if (!idleTex) {
      throw new Error(`WeaponView: missing idle texture "${firstIdle}"`);
    }

    this.weaponSprite = new Sprite(idleTex);
    this.weaponSprite.anchor.set(anchor[0], anchor[1]);
    this.root.addChild(this.weaponSprite);

    if (this.view.muzzleFlash?.frame && this.textures.has(this.view.muzzleFlash.frame)) {
      this.muzzleSprite = new Sprite(this.textures.get(this.view.muzzleFlash.frame));
      this.muzzleSprite.anchor.set(0.5, 0.5);
      this.muzzleSprite.visible = false;
      this.root.addChild(this.muzzleSprite);
    }

    this.player = new AnimPlayer(clipsConfig, {
      applyFrame: (name) => {
        const tex = this.textures.get(name);
        if (tex && this.weaponSprite) this.weaponSprite.texture = tex;
      },
      onEvent: (evt) => {
        if (evt?.name === 'muzzle') this.showMuzzle();
        this._eventHandler?.(evt);
      },
    });

    this.layout();
    this.playEquip();
  }

  async loadGridAtlas(jsonUrl, atlas) {
    const base = jsonUrl.slice(0, jsonUrl.lastIndexOf('/') + 1);
    const imageUrl = base + atlas.image;
    const baseTex = await Assets.load(imageUrl);
    const source = baseTex.source;
    const { cellWidth: cw, cellHeight: ch, columns } = atlas;

    const addCell = (cellIndex, name) => {
      if (this.textures.has(name)) return;
      const col = cellIndex % columns;
      const row = Math.floor(cellIndex / columns);
      const tex = new Texture({
        source,
        frame: new Rectangle(col * cw, row * ch, cw, ch),
      });
      this.textures.set(name, tex);
    };

    if (atlas.frameNames) {
      for (const [indexStr, name] of Object.entries(atlas.frameNames)) {
        addCell(Number(indexStr), name);
      }
    }

    for (const [animName, range] of Object.entries(atlas.animations ?? {})) {
      const start = range.start ?? 0;
      const count = range.count ?? 1;
      for (let i = 0; i < count; i++) {
        addCell(start + i, `${animName}_${i}`);
      }
    }
  }

  async loadTexturePacker(jsonUrl) {
    const sheet = await Assets.load(jsonUrl);
    const textures = sheet.textures ?? sheet;
    for (const [name, tex] of Object.entries(textures)) {
      this.textures.set(name, tex);
    }
  }

  _legacyClips() {
    return {
      idle: {
        frames: this.view.idleFrames ?? ['idle_0'],
        fps: this.view.frameRate ?? 10,
        loop: true,
        priority: 0,
      },
      fire: {
        frames: this.view.fireFrames ?? ['fire_0'],
        fps: this.view.frameRate ?? 12,
        loop: false,
        priority: 45,
        interruptible: false,
      },
    };
  }

  setEventHandler(handler) {
    this._eventHandler = handler;
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
    const minScale = this.view.minScale ?? 0.85;
    const maxScale = this.view.maxScale ?? 1.45;
    let scale = this.view.baseScale * (h / refH);
    scale = Math.min(maxScale, Math.max(minScale, scale));

    const bobAmp = this.view.bobAmplitude ?? 8;
    const swayAmp = this.view.swayAmplitude ?? 3;
    const bobX = this.bobActive ? Math.sin(this.bobPhase) * bobAmp * 0.35 : 0;
    const bobY = this.bobActive ? Math.abs(Math.sin(this.bobPhase)) * bobAmp : 0;
    const swayX = !this.bobActive ? Math.sin(this.swayPhase) * swayAmp : 0;
    const swayY = !this.bobActive ? Math.cos(this.swayPhase * 0.7) * swayAmp * 0.4 : 0;

    this.root.x = w * (1 - ox) + bobX + swayX;
    this.root.y = h * (1 - oy) - this.recoil + bobY + swayY;
    this.root.scale.set(scale);
  }

  showMuzzle() {
    this.muzzleTimer = this.view.muzzleFlash?.duration ?? 0.05;
    if (this.muzzleSprite) {
      const atlasHint = this.atlas?.muzzleHint?.offsetFromAnchor;
      const [mx, my] = this.view.muzzleFlash?.offset ?? atlasHint ?? [-90, -180];
      this.muzzleSprite.position.set(mx, my);
      this.muzzleSprite.visible = true;
      this.root.setChildIndex(this.muzzleSprite, this.root.children.length - 1);
    }
  }

  playFire() {
    this.player?.play('fire', { force: true });
    this.recoil = this.view.recoilPixels ?? 22;
    const hasMuzzleEvt = this.player?.clips?.fire?.events?.some((e) => e.name === 'muzzle');
    if (!hasMuzzleEvt) this.showMuzzle();
    this.shotsSinceReload += 1;
    if (this.shotsSinceReload >= this.reloadEvery) {
      this._pendingReload = true;
    }
  }

  playReload() {
    this.shotsSinceReload = 0;
    this._pendingReload = false;
    return this.player?.play('reload', { force: true });
  }

  playEquip() {
    if (this._equipUnsub) {
      this._equipUnsub();
      this._equipUnsub = null;
    }
    this._pendingReload = false;
    this.shotsSinceReload = 0;
    if (this.player?.clips?.equip) {
      this.player.play('equip', { force: true });
      this._equipUnsub = this.player.onComplete((name) => {
        if (name === 'equip') this.player.play('idle');
      });
    } else {
      this.player?.play('idle', { force: true });
    }
  }

  playLower() {
    this.player?.play('lower', { force: true });
  }

  playIdle() {
    this.player?.play('idle', { force: true });
  }

  update(dt, viewport = {}, { moving = false, playerDead = false } = {}) {
    if (viewport.width && viewport.height) {
      this.layout(viewport.width, viewport.height);
    }

    if (playerDead) {
      if (this.player?.current !== 'lower') this.playLower();
    }

    const current = this.player?.current;
    const busy =
      current === 'fire' ||
      current === 'recoil' ||
      current === 'reload' ||
      current === 'equip' ||
      current === 'lower';

    // Authored walk clip while moving; else procedural bob on idle.
    if (!playerDead && !busy) {
      if (moving && this._hasWalkClip) {
        if (current !== 'walk') this.player?.play('walk');
        this.bobActive = false;
      } else if (moving && !this._hasWalkClip) {
        if (current !== 'idle' && current != null) this.player?.play('idle');
        this.bobActive = true;
        this.bobPhase += dt * (this.view.bobSpeed ?? 10);
      } else {
        if (current === 'walk') this.player?.play('idle');
        this.bobActive = false;
        this.bobPhase *= 0.9;
        if (current === 'idle' || current == null) {
          this.swayPhase += dt * (this.view.swaySpeed ?? 1.6);
        }
      }
    } else {
      this.bobActive = false;
      this.bobPhase *= 0.9;
    }

    this.player?.update(dt);

    if (this._pendingReload && this.player?.finished && this.player?.current === 'fire') {
      this.playReload();
    } else if (this.player?.finished && this.player?.current === 'fire' && !this._pendingReload) {
      if (this.player.clips?.recoil) this.player.play('recoil');
      else this.player.play('idle');
    } else if (this.player?.finished && this.player?.current === 'recoil') {
      if (this._pendingReload) this.playReload();
      else this.player.play('idle');
    }
    if (this.player?.finished && this.player?.current === 'reload') {
      this.player.play('idle');
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0 && this.muzzleSprite) {
        this.muzzleSprite.visible = false;
      }
    }

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - (this.view.recoilRecover ?? 12) * dt * 60);
    }

    this.layout();
  }

  destroy() {
    if (this._equipUnsub) this._equipUnsub();
    this.root.destroy({ children: true });
  }
}
