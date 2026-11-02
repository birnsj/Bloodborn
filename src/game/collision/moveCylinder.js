/**
 * Axis-separated cylinder (XZ) vs AABB collision used by player and enemies.
 * Mutates `position` in place (expects { x, y, z } or THREE.Vector3).
 */
export function moveCylinder(position, radius, dx, dz, colliders, bodyHeight = 1.7) {
  position.x = resolveAxis(position.x + dx, position.z, 'x', radius, colliders, bodyHeight);
  position.z = resolveAxis(position.x, position.z + dz, 'z', radius, colliders, bodyHeight);
  return position;
}

function resolveAxis(x, z, axis, radius, colliders, bodyHeight) {
  let px = x;
  let pz = z;

  for (const box of colliders) {
    if (box.maxY < 0.2 || box.minY > bodyHeight) continue;

    const closestX = clamp(px, box.minX, box.maxX);
    const closestZ = clamp(pz, box.minZ, box.maxZ);
    const offsetX = px - closestX;
    const offsetZ = pz - closestZ;
    const distSq = offsetX * offsetX + offsetZ * offsetZ;

    if (distSq >= radius * radius) continue;

    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      if (axis === 'x') px += offsetX * push;
      else pz += offsetZ * push;
    } else if (axis === 'x') {
      const left = Math.abs(px - box.minX);
      const right = Math.abs(box.maxX - px);
      px = left < right ? box.minX - radius : box.maxX + radius;
    } else {
      const near = Math.abs(pz - box.minZ);
      const far = Math.abs(box.maxZ - pz);
      pz = near < far ? box.minZ - radius : box.maxZ + radius;
    }
  }

  return axis === 'x' ? px : pz;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
