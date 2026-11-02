import * as THREE from 'three';
import { CharacterInstance } from './CharacterInstance.js';

/**
 * Loads character defs and spawns billboard instances from level JSON.
 */
export class CharacterManager {
  constructor() {
    this.defs = {};
    this.instances = new Map();
    this.root = new THREE.Group();
    this.root.name = 'characters_root';
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
    this.sheetCache = new Map();
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

    const frames = await this.loadCharacterFrames(def);
    const instance = new CharacterInstance(instanceDef, def, frames);
    this.instances.set(instance.id, instance);
    this.root.add(instance.root);
    return instance;
  }

  async loadCharacterFrames(def) {
    if (def.spritesheet) {
      return this.loadSpritesheetFrames(def.spritesheet);
    }

    // Legacy Phase 2 single-image sprites.
    const frames = {};
    if (def.sprites?.idle) frames.idle_0 = await this.loadTexture(def.sprites.idle);
    if (def.sprites?.hit) frames.hit_0 = await this.loadTexture(def.sprites.hit);
    if (def.sprites?.dead) frames.dead_0 = await this.loadTexture(def.sprites.dead);
    return frames;
  }

  async loadSpritesheetFrames(jsonUrl) {
    if (this.sheetCache.has(jsonUrl)) {
      return this.sheetCache.get(jsonUrl);
    }

    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load spritesheet JSON: ${jsonUrl}`);
    }
    const atlas = await response.json();
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
      // Three.js UV origin is bottom-left; TexturePacker y is top-left.
      tex.offset.set(x / sheetW, 1 - (y + h) / sheetH);
      tex.needsUpdate = true;
      // Frame pixel size (full sheet image.width is NOT the frame size).
      tex.userData.frameWidth = w;
      tex.userData.frameHeight = h;
      frames[name] = tex;
      this.textures.set(`${jsonUrl}::${name}`, tex);
    }

    this.sheetCache.set(jsonUrl, frames);
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

  applyDamage(characterId, amount) {
    const instance = this.instances.get(characterId);
    if (!instance) return null;
    return instance.applyDamage(amount);
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
