import * as THREE from 'three';

const _direction = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

/**
 * Performs a camera-forward hitscan against world and character meshes.
 * Closest intersection within range wins.
 */
export function castHitscan(camera, worldMeshes, characterMeshes, range) {
  camera.getWorldDirection(_direction);
  _raycaster.set(camera.position, _direction);
  _raycaster.far = range;
  _raycaster.near = 0.05;

  const targets = [];
  if (worldMeshes?.length) targets.push(...worldMeshes);
  if (characterMeshes?.length) targets.push(...characterMeshes);

  if (!targets.length) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const hits = _raycaster.intersectObjects(targets, false);
  if (!hits.length) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const hit = hits[0];
  if (hit.distance > range) {
    return { kind: 'miss', point: null, distance: range, object: null };
  }

  const characterId = hit.object.userData?.characterId;
  if (characterId) {
    return {
      kind: 'character',
      characterId,
      point: hit.point.clone(),
      distance: hit.distance,
      object: hit.object,
    };
  }

  return {
    kind: 'world',
    point: hit.point.clone(),
    distance: hit.distance,
    object: hit.object,
  };
}
