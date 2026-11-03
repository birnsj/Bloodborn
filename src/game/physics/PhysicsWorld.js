import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Shared Rapier world for BloodBound (ragdolls + ground).
 */
export class PhysicsWorld {
  constructor(rapier, world) {
    this.RAPIER = rapier;
    this.world = world;
    this._ready = true;
    this._ragdolls = new Set();
    this._accumulator = 0;
    this.fixedDt = 1 / 60;
  }

  static async create(gravity = { x: 0, y: -16, z: 0 }) {
    await RAPIER.init();
    const world = new RAPIER.World(gravity);
    world.timestep = 1 / 60;
    const physics = new PhysicsWorld(RAPIER, world);
    physics.addGround();
    return physics;
  }

  addGround({ y = 0, size = 80 } = {}) {
    const R = this.RAPIER;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(0, y - 0.5, 0),
    );
    this.world.createCollider(
      R.ColliderDesc.cuboid(size, 0.5, size).setFriction(1.2).setRestitution(0),
      body,
    );
    this._ground = body;
    this._statics = [body];
    return body;
  }

  /** Simple static box walls/floors from center + half-extents. */
  addStaticBox(center, halfExtents, rotation = null) {
    const R = this.RAPIER;
    const desc = R.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
    if (rotation) desc.setRotation(rotation);
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(
      R.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(0.95)
        .setRestitution(0),
      body,
    );
    this._statics ??= [];
    this._statics.push(body);
    return body;
  }

  /**
   * Import gameplay AABB colliders (from levelBuilder) as Rapier static cuboids
   * so ragdolls bounce/slide against walls and props.
   */
  addLevelColliders(colliders = []) {
    for (const c of colliders) {
      if (!c) continue;
      const cx = (c.minX + c.maxX) * 0.5;
      const cy = (c.minY + c.maxY) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      const hx = Math.max(0.05, (c.maxX - c.minX) * 0.5);
      const hy = Math.max(0.05, (c.maxY - c.minY) * 0.5);
      const hz = Math.max(0.05, (c.maxZ - c.minZ) * 0.5);
      this.addStaticBox({ x: cx, y: cy, z: cz }, { x: hx, y: hy, z: hz });
    }
  }

  registerRagdoll(ragdoll) {
    this._ragdolls.add(ragdoll);
  }

  unregisterRagdoll(ragdoll) {
    this._ragdolls.delete(ragdoll);
  }

  step(dt) {
    if (!this.world) return;
    const clamped = Math.min(dt, 0.05);
    this._accumulator += clamped;
    let steps = 0;
    while (this._accumulator >= this.fixedDt && steps < 4) {
      this.world.step();
      this._accumulator -= this.fixedDt;
      steps += 1;
    }
    for (const ragdoll of this._ragdolls) {
      ragdoll.tickSettle?.(clamped);
      ragdoll.syncFromPhysics?.();
    }
  }

  dispose() {
    for (const ragdoll of [...this._ragdolls]) {
      ragdoll.dispose?.();
    }
    this._ragdolls.clear();
    this.world?.free?.();
    this.world = null;
  }
}
