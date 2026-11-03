import * as THREE from 'three';

const _raycaster = new THREE.Raycaster();

/**
 * Closest-hit raycast against a mesh list.
 * Returns { kind, point, distance, object, characterId? }.
 */
export function castRay(origin, direction, meshes, range, options = {}) {
  const near = options.near ?? 0.05;
  _raycaster.set(origin, direction);
  _raycaster.near = near;
  _raycaster.far = range;

  if (!meshes?.length) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const hits = _raycaster.intersectObjects(meshes, false);
  if (!hits.length) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const hit = hits[0];
  if (hit.distance > range) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const normal = hit.face?.normal
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    : null;

  const characterId = hit.object.userData?.characterId;
  if (characterId) {
    return {
      kind: 'character',
      characterId,
      point: hit.point.clone(),
      normal,
      distance: hit.distance,
      object: hit.object,
    };
  }

  if (hit.object.userData?.isPlayerHit) {
    return {
      kind: 'player',
      point: hit.point.clone(),
      normal,
      distance: hit.distance,
      object: hit.object,
    };
  }

  return {
    kind: 'world',
    point: hit.point.clone(),
    normal,
    distance: hit.distance,
    object: hit.object,
  };
}

/**
 * True if the segment origin→target is unobstructed by worldMeshes
 * (or the first hit is beyond targetDistance - epsilon).
 */
export function hasLineOfSight(origin, target, worldMeshes, maxRange = 100) {
  const direction = new THREE.Vector3().subVectors(target, origin);
  const distance = direction.length();
  if (distance < 1e-4) return true;
  direction.multiplyScalar(1 / distance);

  const result = castRay(origin, direction, worldMeshes, Math.min(distance, maxRange));
  if (result.kind === 'miss') return true;
  // Allow a small tolerance so grazing hits near the target still count as LOS.
  return result.distance >= distance - 0.15;
}
