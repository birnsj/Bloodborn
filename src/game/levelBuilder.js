import * as THREE from 'three';

/**
 * Builds renderable meshes and collision AABBs from portable map JSON.
 * Object visuals come from the asset registry; colliders come from instance data only.
 */
export function buildLevel(map, materials, assetRegistry) {
  const root = new THREE.Group();
  root.name = 'level_root';
  const colliders = [];
  const ownedGeometries = [];
  const raycastMeshes = [];

  for (const room of map.rooms) {
    const { min, max } = room.bounds;
    const width = max[0] - min[0];
    const depth = max[2] - min[2];
    const cx = (min[0] + max[0]) * 0.5;
    const cz = (min[2] + max[2]) * 0.5;

    const floorPos = [cx, min[1] - 0.05, cz];
    const floorSize = [width, 0.1, depth];
    const floor = createBoxMesh({
      id: room.floor.id,
      material: materials.get(room.floor.material, width, depth),
      position: floorPos,
      size: floorSize,
      receiveShadow: true,
      ownedGeometries,
    });
    root.add(floor);
    raycastMeshes.push(floor);
    // Walkable tops for grounding / stairs (do not block horizontally).
    colliders.push(createCollider(room.floor.id, floorPos, floorSize, 0, true));

    const ceiling = createBoxMesh({
      id: room.ceiling.id,
      material: materials.get(room.ceiling.material, width, depth),
      position: [cx, max[1] + 0.05, cz],
      size: [width, 0.1, depth],
      receiveShadow: true,
      ownedGeometries,
    });
    root.add(ceiling);
    raycastMeshes.push(ceiling);
  }

  for (const wall of map.walls) {
    const [sx, sy, sz] = wall.size;
    const u = Math.max(sx, sz);
    const rotY = wall.rotation?.[1] ?? 0;
    const mesh = createBoxMesh({
      id: wall.id,
      material: materials.get(wall.material, u, sy),
      position: wall.position,
      size: wall.size,
      rotationY: rotY,
      castShadow: true,
      receiveShadow: true,
      ownedGeometries,
    });
    root.add(mesh);
    raycastMeshes.push(mesh);

    if (wall.collision?.enabled !== false) {
      colliders.push(
        createCollider(
          wall.id,
          wall.position,
          wall.size,
          rotY,
          wall.collision?.walkable === true,
        ),
      );
    }
  }

  for (const door of map.doorways ?? []) {
    if (!door.frame) continue;
    const frame = buildDoorFrame(door, materials, ownedGeometries);
    root.add(frame);
    frame.traverse((child) => {
      if (child.isMesh) raycastMeshes.push(child);
    });
  }

  for (const obj of map.objects) {
    const assetDef = assetRegistry.getDef?.(obj.assetId) ?? null;
    const scale = obj.scale ?? [1, 1, 1];
    const visual = assetRegistry.createVisual(obj.assetId, scale);
    visual.name = obj.id;
    visual.position.x += obj.position[0];
    // createVisual already offsets local Y for floor contact; add instance Y.
    visual.position.y += obj.position[1];
    visual.position.z += obj.position[2];

    const [rx, ry, rz] = obj.rotation ?? [0, 0, 0];
    visual.rotation.set(rx, ry, rz);
    root.add(visual);

    const collision = resolveObjectCollision(obj, assetDef, scale);
    if (collision?.enabled) {
      const size = collision.size;
      const offset = collision.offset ?? [0, size[1] * 0.5, 0];
      const center = [
        obj.position[0] + offset[0],
        obj.position[1] + offset[1],
        obj.position[2] + offset[2],
      ];
      colliders.push(
        createCollider(obj.id, center, size, ry, collision.walkable === true),
      );
      visual.traverse((child) => {
        if (child.isMesh) raycastMeshes.push(child);
      });
    }
  }

  return { root, colliders, ownedGeometries, raycastMeshes };
}

function buildDoorFrame(door, materials, ownedGeometries) {
  const group = new THREE.Group();
  group.name = door.id;
  const [w, h] = door.size;
  const t = door.frame.thickness ?? 0.12;
  const material = materials.get(door.frame.material, 1, h);
  const [cx, cy, cz] = door.center;

  group.add(
    createBoxMesh({
      id: `${door.frame.id}_left`,
      material,
      position: [cx - w * 0.5 - t * 0.5, cy, cz],
      size: [t, h, t * 1.4],
      castShadow: true,
      receiveShadow: true,
      ownedGeometries,
    }),
    createBoxMesh({
      id: `${door.frame.id}_right`,
      material,
      position: [cx + w * 0.5 + t * 0.5, cy, cz],
      size: [t, h, t * 1.4],
      castShadow: true,
      receiveShadow: true,
      ownedGeometries,
    }),
    createBoxMesh({
      id: `${door.frame.id}_top`,
      material,
      position: [cx, cy + h * 0.5 + t * 0.5, cz],
      size: [w + t * 2, t, t * 1.4],
      castShadow: true,
      receiveShadow: true,
      ownedGeometries,
    }),
  );

  return group;
}

function createBoxMesh({
  id,
  material,
  position,
  size,
  rotationY = 0,
  castShadow = false,
  receiveShadow = false,
  ownedGeometries,
}) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  ownedGeometries.push(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = id;
  mesh.position.fromArray(position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** Prefer instance collision; fall back to furniture JSON defaults × scale. */
function resolveObjectCollision(obj, assetDef, scale) {
  const inst = obj.collision;
  if (inst?.enabled === false) return null;

  if (inst?.size) {
    return {
      enabled: inst.enabled !== false,
      size: inst.size,
      offset: inst.offset,
      walkable: inst.walkable === true,
    };
  }

  const defCol = assetDef?.collision;
  if (!defCol || defCol.enabled === false) {
    if (inst?.enabled) {
      const size = obj.scale ?? [1, 1, 1];
      return { enabled: true, size, offset: inst.offset, walkable: inst.walkable === true };
    }
    return null;
  }

  const [sx, sy, sz] = scale;
  const [dx, dy, dz] = defCol.size ?? [1, 1, 1];
  const size = [dx * sx, dy * sy, dz * sz];
  const [ox, oy, oz] = defCol.offset ?? [0, (defCol.size?.[1] ?? 1) * 0.5, 0];
  return {
    enabled: true,
    size,
    offset: [ox * sx, oy * sy, oz * sz],
    walkable: inst?.walkable === true || defCol.walkable === true,
  };
}

function createCollider(id, position, size, rotationY = 0, walkable = false) {
  const [sx, sy, sz] = size;
  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  const halfX = (sx * cos + sz * sin) * 0.5;
  const halfZ = (sx * sin + sz * cos) * 0.5;
  const halfY = sy * 0.5;

  return {
    id,
    walkable: !!walkable,
    minX: position[0] - halfX,
    maxX: position[0] + halfX,
    minY: position[1] - halfY,
    maxY: position[1] + halfY,
    minZ: position[2] - halfZ,
    maxZ: position[2] + halfZ,
  };
}

export function disposeLevel(root, ownedGeometries = []) {
  for (const geo of ownedGeometries) {
    geo.dispose();
  }
  // GLB / asset geometries are owned by AssetRegistry.
  root.traverse((obj) => {
    // Skip disposing shared materials (MaterialLibrary) and registry-owned geos.
  });
}
