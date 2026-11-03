import * as THREE from 'three';
import { castRay } from './raycast.js';

const _ndc = new THREE.Vector2(0, 0);
const _origin = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

/**
 * Screen-center hitscan (crosshair). Uses the camera projection so the ray
 * matches what the player sees at the reticle.
 */
export function castHitscan(camera, worldMeshes, characterMeshes, range) {
  camera.updateMatrixWorld(true);
  _raycaster.setFromCamera(_ndc, camera);
  _origin.copy(_raycaster.ray.origin);
  _direction.copy(_raycaster.ray.direction);

  const targets = [];
  if (worldMeshes?.length) targets.push(...worldMeshes);
  if (characterMeshes?.length) {
    for (const mesh of characterMeshes) {
      mesh.updateMatrixWorld?.(true);
      targets.push(mesh);
    }
  }

  return castRay(_origin, _direction, targets, range);
}
