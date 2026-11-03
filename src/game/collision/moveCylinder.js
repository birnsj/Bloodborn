/**
 * Axis-separated cylinder (XZ) vs AABB collision used by player and enemies.
 * Mutates `position` in place (expects { x, y, z } or THREE.Vector3).
 *
 * Tries both axis orders and finishes with a 2D depenetration pass so
 * sharp wall corners don't pinch / trap the capsule.
 *
 * Walkable AABBs (`walkable: true`) never block horizontally; they are used
 * by applyVertical for grounding / step-up / gravity.
 */

export const WALK_MAX_STEP = 0.35;
export const WALK_GRAVITY = 22;
/** Vertical blend speed toward walkable tops (stairs feel continuous). */
export const WALK_STEP_SPEED = 7;

/**
 * Axis-separated cylinder (XZ) vs AABB collision used by player and enemies.
 * Mutates `position` in place (expects { x, y, z } or THREE.Vector3).
 */
export function moveCylinder(position, radius, dx, dz, colliders, bodyHeight = 1.7) {
  const startX = position.x;
  const startZ = position.z;
  const feetY = position.y;

  // X then Z
  const x1 = resolveAxis(startX + dx, startZ, 'x', radius, colliders, feetY, bodyHeight);
  const z1 = resolveAxis(x1, startZ + dz, 'z', radius, colliders, feetY, bodyHeight);

  // Z then X — often frees a corner the other order traps
  const z2 = resolveAxis(startX, startZ + dz, 'z', radius, colliders, feetY, bodyHeight);
  const x2 = resolveAxis(startX + dx, z2, 'x', radius, colliders, feetY, bodyHeight);

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

/**
 * Snap to walkable tops within max step, or fall under gravity.
 * Call once per frame after horizontal movement (player and enemies).
 */
export function applyVertical(position, radius, colliders, dt = 0, opts = {}) {
  const maxStep = opts.maxStep ?? WALK_MAX_STEP;
  const gravity = opts.gravity ?? WALK_GRAVITY;
  const stepSpeed = opts.stepSpeed ?? WALK_STEP_SPEED;
  const dtClamped = Math.max(0, dt);
  if (position._walkVy == null) position._walkVy = 0;

  const support = findSupportY(
    position.x,
    position.z,
    radius,
    colliders,
    position.y + maxStep,
  );

  // Within one step of a walkable: ease Y toward it (up or down) instead of snapping.
  if (
    support != null &&
    support >= position.y - maxStep &&
    support <= position.y + maxStep
  ) {
    const dy = support - position.y;
    const maxDy = stepSpeed * dtClamped;
    if (dtClamped === 0 || Math.abs(dy) <= maxDy) {
      position.y = support;
    } else {
      position.y += Math.sign(dy) * maxDy;
    }
    position._walkVy = 0;
    position._walkGrounded = true;
    return;
  }

  position._walkGrounded = false;
  position._walkVy -= gravity * dtClamped;
  position.y += position._walkVy * dtClamped;

  const land = findSupportY(position.x, position.z, radius, colliders, position.y + 0.05);
  if (land != null && position.y <= land) {
    position.y = land;
    position._walkVy = 0;
    position._walkGrounded = true;
  }
}

/** Highest walkable top under the cylinder with top <= yMax. */
export function findSupportY(x, z, radius, colliders, yMax) {
  let best = null;
  const r2 = radius * radius;
  for (const box of colliders) {
    if (!box.walkable) continue;
    if (box.maxY > yMax) continue;

    const closestX = clamp(x, box.minX, box.maxX);
    const closestZ = clamp(z, box.minZ, box.maxZ);
    const ox = x - closestX;
    const oz = z - closestZ;
    if (ox * ox + oz * oz > r2) continue;

    if (best == null || box.maxY > best) best = box.maxY;
  }
  return best;
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

function bodyHitsWall(box, feetY, bodyHeight) {
  if (box.walkable) return false;
  const headY = feetY + bodyHeight;
  if (box.maxY <= feetY + 0.05) return false;
  if (box.minY >= headY - 0.05) return false;
  return true;
}

function resolveAxis(x, z, axis, radius, colliders, feetY, bodyHeight) {
  let px = x;
  let pz = z;

  for (const box of colliders) {
    if (!bodyHitsWall(box, feetY, bodyHeight)) continue;

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
  const feetY = position.y;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const box of colliders) {
      if (!bodyHitsWall(box, feetY, bodyHeight)) continue;

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
