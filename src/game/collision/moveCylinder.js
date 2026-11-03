/**
 * Axis-separated cylinder (XZ) vs AABB collision used by player and enemies.
 * Mutates `position` in place (expects { x, y, z } or THREE.Vector3).
 *
 * Tries both axis orders and finishes with a 2D depenetration pass so
 * sharp wall corners don't pinch / trap the capsule.
 */
export function moveCylinder(position, radius, dx, dz, colliders, bodyHeight = 1.7) {
  const startX = position.x;
  const startZ = position.z;

  // X then Z
  const x1 = resolveAxis(startX + dx, startZ, 'x', radius, colliders, bodyHeight);
  const z1 = resolveAxis(x1, startZ + dz, 'z', radius, colliders, bodyHeight);

  // Z then X — often frees a corner the other order traps
  const z2 = resolveAxis(startX, startZ + dz, 'z', radius, colliders, bodyHeight);
  const x2 = resolveAxis(startX + dx, z2, 'x', radius, colliders, bodyHeight);

  const d1 = (x1 - startX) ** 2 + (z1 - startZ) ** 2;
  const d2 = (x2 - startX) ** 2 + (z2 - startZ) ** 2;

  if (d2 > d1) {
    position.x = x2;
    position.z = z2;
  } else {
    position.x = x1;
    position.z = z1;
  }

  depenetrate(position, radius, colliders, bodyHeight);
  return position;
}

/**
 * Move with wall-slide: if the wish vector is blocked, try perpendicular
 * slides and keep the one that travels farthest / progresses toward optional goal.
 * Returns distance actually moved.
 */
export function moveCylinderSlide(
  position,
  radius,
  dx,
  dz,
  colliders,
  bodyHeight = 1.7,
  goalX = null,
  goalZ = null,
) {
  const startX = position.x;
  const startZ = position.z;
  const wishLen = Math.hypot(dx, dz);
  if (wishLen < 1e-8) return 0;

  moveCylinder(position, radius, dx, dz, colliders, bodyHeight);
  let bestX = position.x;
  let bestZ = position.z;
  let bestMoved = Math.hypot(bestX - startX, bestZ - startZ);

  if (bestMoved >= wishLen * 0.45) {
    return bestMoved;
  }

  const nx = dx / wishLen;
  const nz = dz / wishLen;
  // Perpendicular slides + mild forward blends so corners don't dead-stop.
  const candidates = [
    { x: -nz * wishLen, z: nx * wishLen },
    { x: nz * wishLen, z: -nx * wishLen },
    { x: (nx * 0.35 - nz) * wishLen, z: (nz * 0.35 + nx) * wishLen },
    { x: (nx * 0.35 + nz) * wishLen, z: (nz * 0.35 - nx) * wishLen },
  ];

  let bestScore = scoreCandidate(bestX, bestZ, startX, startZ, nx, nz, goalX, goalZ);

  for (const c of candidates) {
    position.x = startX;
    position.z = startZ;
    moveCylinder(position, radius, c.x, c.z, colliders, bodyHeight);
    const moved = Math.hypot(position.x - startX, position.z - startZ);
    if (moved < wishLen * 0.08) continue;
    const score = scoreCandidate(position.x, position.z, startX, startZ, nx, nz, goalX, goalZ);
    if (score > bestScore) {
      bestScore = score;
      bestX = position.x;
      bestZ = position.z;
      bestMoved = moved;
    }
  }

  position.x = bestX;
  position.z = bestZ;
  return bestMoved;
}

function scoreCandidate(x, z, startX, startZ, nx, nz, goalX, goalZ) {
  const mx = x - startX;
  const mz = z - startZ;
  const moved = Math.hypot(mx, mz);
  const along = mx * nx + mz * nz;
  let toward = 0;
  if (goalX != null && goalZ != null) {
    const before = Math.hypot(goalX - startX, goalZ - startZ);
    const after = Math.hypot(goalX - x, goalZ - z);
    toward = before - after;
  }
  return moved * 1.2 + along * 0.6 + toward * 2.0;
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

/** Full 2D push-out so a capsule pinched between two AABBs can escape the seam. */
function depenetrate(position, radius, colliders, bodyHeight) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const box of colliders) {
      if (box.maxY < 0.2 || box.minY > bodyHeight) continue;

      const closestX = clamp(position.x, box.minX, box.maxX);
      const closestZ = clamp(position.z, box.minZ, box.maxZ);
      let offsetX = position.x - closestX;
      let offsetZ = position.z - closestZ;
      let distSq = offsetX * offsetX + offsetZ * offsetZ;

      if (distSq >= radius * radius) continue;

      if (distSq <= 1e-8) {
        // Deep inside / exact corner — push toward nearest outside face.
        const left = position.x - box.minX + radius;
        const right = box.maxX - position.x + radius;
        const near = position.z - box.minZ + radius;
        const far = box.maxZ - position.z + radius;
        const m = Math.min(left, right, near, far);
        if (m === left) position.x = box.minX - radius;
        else if (m === right) position.x = box.maxX + radius;
        else if (m === near) position.z = box.minZ - radius;
        else position.z = box.maxZ + radius;
        moved = true;
        continue;
      }

      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      position.x += offsetX * push;
      position.z += offsetZ * push;
      moved = true;
    }
    if (!moved) break;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
