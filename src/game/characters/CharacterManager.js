import * as THREE from 'three';
import { CharacterInstance } from './CharacterInstance.js';
import { buildModelClips } from './ModelAnimator.js';
import { loadGridAtlas, buildClipsFromGrid } from '../animation/gridAtlas.js';

/**
 * Loads character defs and spawns 3D / billboard instances from level JSON.
 */
export class CharacterManager {
  constructor({ audioBus, physics, scene } = {}) {
    this.defs = {};
    this.instances = new Map();
    this.root = new THREE.Group();
    this.root.name = 'characters_root';
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
    this.sheetCache = new Map();
    this.audioBus = audioBus ?? null;
    this.physics = physics ?? null;
    this.scene = scene ?? null;
  }

  setPhysics(physics, scene = null) {
    this.physics = physics;
    if (scene) this.scene = scene;
    for (const instance of this.instances.values()) {
      instance.physics = physics;
      if (scene) instance.scene = scene;
    }
  }

  async loadDefs(url = '/data/characters.json') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load characters (${response.status}): ${url}`);
    }
    this.defs = await response.json();
  }

  async spawnFromLevel(levelCharacters = []) {
    for (const instanceDef of levelCharacters) {
      await this.spawn(instanceDef);
    }
  }

  async spawn(instanceDef) {
    const def = this.defs[instanceDef.characterId];
    if (!def) {
      throw new Error(`Unknown characterId: ${instanceDef.characterId}`);
    }

    const { frameTextures, clips, anchor } = await this.loadCharacterFrames(def);
    const instance = new CharacterInstance(instanceDef, def, {
      frameTextures,
      clips,
      anchor,
      audioBus: this.audioBus,
      physics: this.physics,
      scene: this.scene,
    });
    this.instances.set(instance.id, instance);
    this.root.add(instance.root);
    return instance;
  }

  async loadCharacterFrames(def) {
    if (def.view?.mode === 'model3d') {
      return {
        frameTextures: {},
        clips: buildModelClips(def.animations ?? {}),
        anchor: def.anchor ?? [0.5, 0],
      };
    }

    if (def.spritesheet) {
      return this.loadSpritesheetWithClips(def);
    }

    // Legacy Phase 2 single-image sprites.
    const frameTextures = {};
    if (def.sprites?.idle) frameTextures.idle_0 = await this.loadTexture(def.sprites.idle);
    if (def.sprites?.hit) frameTextures.hit_0 = await this.loadTexture(def.sprites.hit);
    if (def.sprites?.dead) frameTextures.dead_0 = await this.loadTexture(def.sprites.dead);

    const clips = {};
    for (const [name, cfg] of Object.entries(def.animations ?? {})) {
      clips[name] = { ...cfg };
    }
    return { frameTextures, clips, anchor: def.anchor ?? [0.5, 0] };
  }

  async loadSpritesheetWithClips(def) {
    const jsonUrl = def.spritesheet;
    const cacheKey = `${jsonUrl}::${def.facingMode ?? 'mirror5'}`;
    if (this.sheetCache.has(cacheKey)) {
      return this.sheetCache.get(cacheKey);
    }

    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load spritesheet JSON: ${jsonUrl}`);
    }
    const atlas = await response.json();

    let frameTextures;
    let animRanges = {};
    const anchor = def.anchor ?? atlas.anchor ?? [0.5, 0];

    if (atlas.cellWidth && atlas.cellHeight && atlas.columns && atlas.rows) {
      const grid = await loadGridAtlas(jsonUrl, this.loader, this.textures);
      frameTextures = grid.frameTextures;
      animRanges = grid.animRanges;
      // Keep textures map entries for dispose
      for (const [k, tex] of Object.entries(frameTextures)) {
        this.textures.set(`${jsonUrl}::${k}`, tex);
      }
    } else {
      frameTextures = await this.loadTexturePackerFrames(jsonUrl, atlas);
    }

    // Merge additional even-grid sheets referenced by clips (dedupe by URL).
    const loadedSheets = new Set([jsonUrl]);
    for (const cfg of Object.values(def.animations ?? {})) {
      const sheetUrl = cfg?.spritesheet;
      if (!sheetUrl || loadedSheets.has(sheetUrl)) continue;
      loadedSheets.add(sheetUrl);
      const extra = await loadGridAtlas(sheetUrl, this.loader, this.textures);
      Object.assign(frameTextures, extra.frameTextures);
      Object.assign(animRanges, extra.animRanges);
      for (const [k, tex] of Object.entries(extra.frameTextures)) {
        this.textures.set(`${sheetUrl}::${k}`, tex);
      }
    }

    const clips = buildClipsFromGrid(def.animations, animRanges);
    // Ensure priorities / interrupt defaults for known oneshots
    for (const [name, clip] of Object.entries(clips)) {
      if (['death', 'dead', 'hit', 'attack', 'strafeAttack', 'alert'].includes(name) && clip.loop == null) {
        clip.loop = name === 'dead' ? true : false;
      }
      if (name === 'dead') clip.loop = true;
      if ((name === 'attack' || name === 'strafeAttack') && clip.interruptible == null) {
        clip.interruptible = false;
      }
      if (name === 'death' && clip.interruptible == null) clip.interruptible = false;
    }

    const result = { frameTextures, clips, anchor };
    this.sheetCache.set(cacheKey, result);
    return result;
  }

  async loadTexturePackerFrames(jsonUrl, atlas) {
    const imageName = atlas.meta?.image;
    if (!imageName) throw new Error(`Spritesheet missing meta.image: ${jsonUrl}`);

    const base = jsonUrl.slice(0, jsonUrl.lastIndexOf('/') + 1);
    const imageUrl = base + imageName;
    const sheetTexture = await this.loadTexture(imageUrl);

    const frames = {};
    const image = sheetTexture.image;
    const sheetW = image.width;
    const sheetH = image.height;

    for (const [name, entry] of Object.entries(atlas.frames ?? {})) {
      const { x, y, w, h } = entry.frame;
      const tex = sheetTexture.clone();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(w / sheetW, h / sheetH);
      tex.offset.set(x / sheetW, 1 - (y + h) / sheetH);
      tex.needsUpdate = true;
      tex.userData.frameWidth = w;
      tex.userData.frameHeight = h;
      frames[name] = tex;
      this.textures.set(`${jsonUrl}::${name}`, tex);
    }
    return frames;
  }

  loadTexture(url) {
    if (this.textures.has(url)) {
      return Promise.resolve(this.textures.get(url));
    }
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          this.textures.set(url, texture);
          resolve(texture);
        },
        undefined,
        () => reject(new Error(`Failed to load character sprite: ${url}`)),
      );
    });
  }

  getHitMeshes() {
    const meshes = [];
    for (const instance of this.instances.values()) {
      if (!instance.dead && instance.hitProxy.visible) {
        meshes.push(instance.hitProxy);
      }
    }
    return meshes;
  }

  applyDamage(characterId, amount, hitInfo = null) {
    const instance = this.instances.get(characterId);
    if (!instance) return null;
    return instance.applyDamage(amount, hitInfo);
  }

  resetAll() {
    for (const instance of this.instances.values()) {
      instance.reset();
    }
  }

  update(dt, context = {}) {
    for (const instance of this.instances.values()) {
      instance.update(dt, context);
    }
  }

  dispose() {
    for (const instance of this.instances.values()) {
      this.root.remove(instance.root);
      instance.dispose();
    }
    this.instances.clear();
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();
    this.sheetCache.clear();
  }
}
