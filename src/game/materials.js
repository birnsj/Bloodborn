import * as THREE from 'three';

/**
 * Creates and caches MeshStandardMaterials from portable material definitions.
 * Albedo maps use SRGBColorSpace; tiling follows surface size × repeatPerMeter.
 */
export class MaterialLibrary {
  constructor() {
    this.defs = new Map();
    this.cache = new Map();
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
  }

  async loadFromMap(map) {
    this.defs.clear();
    const entries = Object.entries(map.materials ?? {});

    await Promise.all(
      entries.map(async ([key, def]) => {
        this.defs.set(key, def);
        if (def.albedo) {
          const texture = await this.loadTexture(def.albedo);
          this.textures.set(key, texture);
        }
      }),
    );
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
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
          this.textures.set(url, texture);
          resolve(texture);
        },
        undefined,
        () => reject(new Error(`Failed to load texture: ${url}`)),
      );
    });
  }

  /**
   * @param {string} materialId
   * @param {number} width meters along U
   * @param {number} height meters along V
   */
  get(materialId, width = 1, height = 1) {
    const def = this.defs.get(materialId);
    if (!def) {
      throw new Error(`Unknown material: ${materialId}`);
    }

    const cacheKey = `${materialId}|${width.toFixed(2)}x${height.toFixed(2)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color ?? '#ffffff'),
      roughness: def.roughness ?? 0.9,
      metalness: def.metalness ?? 0,
    });

    const sourceTex = this.textures.get(materialId) ?? this.textures.get(def.albedo);
    if (sourceTex) {
      const map = sourceTex.clone();
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = sourceTex.anisotropy;
      const [rx, ry] = def.repeatPerMeter ?? [0.5, 0.5];
      map.repeat.set(Math.max(0.01, width * rx), Math.max(0.01, height * ry));
      map.needsUpdate = true;
      material.map = map;
    }

    this.cache.set(cacheKey, material);
    return material;
  }

  dispose() {
    for (const material of this.cache.values()) {
      if (material.map) material.map.dispose();
      material.dispose();
    }
    this.cache.clear();

    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();
    this.defs.clear();
  }
}
