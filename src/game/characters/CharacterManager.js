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

    const textures = {
      idle: await this.loadTexture(def.sprites.idle),
      hit: await this.loadTexture(def.sprites.hit),
      dead: await this.loadTexture(def.sprites.dead),
    };

    const instance = new CharacterInstance(instanceDef, def, textures);
    this.instances.set(instance.id, instance);
    this.root.add(instance.root);
    return instance;
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

  update(dt) {
    for (const instance of this.instances.values()) {
      instance.update(dt);
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
  }
}
