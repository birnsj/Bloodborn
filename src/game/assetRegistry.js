import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Resolves asset IDs from assets.json (and included furniture JSON files)
 * into primitive meshes, composed furniture, or GLB scenes.
 * Visual assets are independent of instance collision data.
 */
export class AssetRegistry {
  constructor(materials) {
    this.materials = materials;
    this.defs = new Map();
    this.gltfCache = new Map();
    this.gltfLoader = new GLTFLoader();
    this.ownedGeometries = [];
  }

  async load(url) {
    this.defs.clear();
    await this.mergeDoc(await this.fetchJson(url));

    // Preload GLB assets referenced by the registry.
    const glbUrls = [...this.defs.values()]
      .filter((d) => d.type === 'glb' && d.url)
      .map((d) => d.url);
    await Promise.all([...new Set(glbUrls)].map((u) => this.loadGltf(u)));
  }

  async fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load assets (${response.status}): ${url}`);
    }
    return response.json();
  }

  async mergeDoc(doc) {
    if (!doc || typeof doc !== 'object') return;

    for (const [id, def] of Object.entries(doc.assets ?? {})) {
      this.defs.set(id, { ...def, id: def.id ?? id });
    }

    // Standalone furniture / asset files (one definition per JSON).
    if (doc.id && doc.type && doc.type !== 'catalog') {
      this.defs.set(doc.id, doc);
    }

    for (const include of doc.includes ?? []) {
      await this.mergeDoc(await this.fetchJson(include));
    }
  }

  getDef(assetId) {
    return this.defs.get(assetId) ?? null;
  }

  loadGltf(url) {
    if (this.gltfCache.has(url)) {
      return Promise.resolve(this.gltfCache.get(url));
    }
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.gltfCache.set(url, gltf);
          resolve(gltf);
        },
        undefined,
        () => reject(new Error(`Failed to load GLB: ${url}`)),
      );
    });
  }

  /**
   * Creates a visual Object3D for an asset.
   * scale is the instance visual scale [x,y,z] in meters for primitives
   * (maps to mesh dimensions). For GLB, applied as object.scale.
   */
  createVisual(assetId, scale = [1, 1, 1]) {
    const def = this.defs.get(assetId);
    if (!def) {
      throw new Error(`Unknown assetId: ${assetId}`);
    }

    if (def.type === 'glb') {
      return this.createGlbVisual(def, scale);
    }
    if (def.type === 'primitive') {
      return this.createPrimitiveVisual(def, scale);
    }
    if (def.type === 'furniture') {
      return this.createFurnitureVisual(def, scale);
    }
    throw new Error(`Unsupported asset type "${def.type}" for ${assetId}`);
  }

  createGlbVisual(def, scale) {
    const gltf = this.gltfCache.get(def.url);
    if (!gltf) {
      throw new Error(`GLB not loaded: ${def.url}`);
    }
    const root = gltf.scene.clone(true);
    root.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    // Unit-cube GLBs: scale maps directly to world size.
    root.scale.set(scale[0], scale[1], scale[2]);
    // Lift so origin sits on the floor contact point (bottom of unit cube at y=-0.5).
    root.position.y = scale[1] * 0.5;
    return root;
  }

  createPrimitiveVisual(def, scale) {
    const [sx, sy, sz] = scale;
    const material = this.materials.get(def.material, Math.max(sx, sz), sy);
    const group = new THREE.Group();

    switch (def.primitive) {
      case 'box':
      case 'beam': {
        const geo = new THREE.BoxGeometry(sx, sy, sz);
        this.ownedGeometries.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = sy * 0.5;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        break;
      }
      case 'cylinder': {
        const geo = new THREE.CylinderGeometry(sx * 0.5, sx * 0.5, sy, 16);
        this.ownedGeometries.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = sy * 0.5;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        break;
      }
      case 'pillar': {
        const shaftGeo = new THREE.CylinderGeometry(sx * 0.42, sx * 0.48, sy * 0.88, 16);
        const baseGeo = new THREE.BoxGeometry(sx, sy * 0.08, sz);
        const capitalGeo = new THREE.BoxGeometry(sx * 1.15, sy * 0.08, sz * 1.15);
        this.ownedGeometries.push(shaftGeo, baseGeo, capitalGeo);

        const shaft = new THREE.Mesh(shaftGeo, material);
        shaft.position.y = sy * 0.5;
        shaft.castShadow = true;
        shaft.receiveShadow = true;

        const base = new THREE.Mesh(baseGeo, material);
        base.position.y = sy * 0.04;
        base.castShadow = true;
        base.receiveShadow = true;

        const capital = new THREE.Mesh(capitalGeo, material);
        capital.position.y = sy * 0.96;
        capital.castShadow = true;
        capital.receiveShadow = true;

        group.add(shaft, base, capital);
        break;
      }
      default:
        throw new Error(`Unknown primitive "${def.primitive}"`);
    }

    return group;
  }

  /**
   * Composed furniture from a standalone JSON def.
   * Part positions/sizes are meters at scale [1,1,1]; instance scale multiplies them.
   * Group origin is floor contact (parts already include vertical centers).
   */
  createFurnitureVisual(def, scale = [1, 1, 1]) {
    const [sx, sy, sz] = scale;
    const group = new THREE.Group();

    for (const part of def.parts ?? []) {
      const [px, py, pz] = part.position ?? [0, 0, 0];
      const [psx, psy, psz] = part.size ?? [1, 1, 1];
      const size = [psx * sx, psy * sy, psz * sz];
      const material = this.materials.get(
        part.material ?? def.material ?? 'wood',
        Math.max(size[0], size[2]),
        size[1],
      );

      let mesh;
      if (part.primitive === 'cylinder') {
        const geo = new THREE.CylinderGeometry(size[0] * 0.5, size[0] * 0.5, size[1], 12);
        this.ownedGeometries.push(geo);
        mesh = new THREE.Mesh(geo, material);
      } else {
        const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
        this.ownedGeometries.push(geo);
        mesh = new THREE.Mesh(geo, material);
      }

      mesh.position.set(px * sx, py * sy, pz * sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  dispose() {
    for (const geo of this.ownedGeometries) {
      geo.dispose();
    }
    this.ownedGeometries = [];

    for (const gltf of this.gltfCache.values()) {
      gltf.scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
    this.gltfCache.clear();
    this.defs.clear();
  }
}
