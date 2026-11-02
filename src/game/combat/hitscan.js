import * as THREE from 'three';
import { castRay } from './raycast.js';

const _direction = new THREE.Vector3();

/**
 * Camera-forward player hitscan against world + character meshes.
 */
export function castHitscan(camera, worldMeshes, characterMeshes, range) {
  camera.getWorldDirection(_direction);
  const targets = [];
  if (worldMeshes?.length) targets.push(...worldMeshes);
  if (characterMeshes?.length) targets.push(...characterMeshes);
  return castRay(camera.position, _direction, targets, range);
}
