import * as THREE from 'three';
import { moveCylinder } from '../collision/moveCylinder.js';
import { hasLineOfSight } from '../combat/raycast.js';

const STATES = {
  IDLE: 'idle',
  CHASE: 'chase',
  ATTACK: 'attack',
  HIT: 'hit',
  DEATH: 'death',
};

/**
 * Simple steering AI for a single ranged billboard enemy.
 */
export class EnemyBrain {
  constructor(character, def) {
    this.character = character;
    this.def = def;
    this.state = STATES.IDLE;
    this.alerted = false;
    this.attackCooldown = 0;
    this.windupTimer = 0;
    this.hitTimer = 0;
    this.strafeSign = 1;
    this.strafeTimer = 0;

    this._origin = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  reset() {
    this.state = STATES.IDLE;
    this.alerted = false;
    this.attackCooldown = 0;
    this.windupTimer = 0;
    this.hitTimer = 0;
    this.strafeTimer = 0;
    this.character.animator?.play('idle', { force: true });
  }

  onDamaged() {
    if (this.character.dead) {
      this.enter(STATES.DEATH);
      return;
    }
    this.enter(STATES.HIT);
  }

  onDeath() {
    this.enter(STATES.DEATH);
  }

  enter(next) {
    if (this.state === STATES.DEATH && next !== STATES.DEATH) return;
    this.state = next;
    if (next === STATES.IDLE) this.character.animator?.play('idle');
    if (next === STATES.CHASE) this.character.animator?.play('walk');
    if (next === STATES.ATTACK) {
      this.windupTimer = this.def.attackWindup ?? 0.25;
      this.character.animator?.play('attack', { force: true });
    }
    if (next === STATES.HIT) {
      this.hitTimer = 0.15;
      this.character.animator?.play('hit', { force: true });
    }
    if (next === STATES.DEATH) {
      this.character.animator?.play('death', { force: true });
    }
  }

  update(dt, context) {
    if (this.character.dead) {
      if (this.state !== STATES.DEATH) this.enter(STATES.DEATH);
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const player = context.playerPosition;
    const playerAlive = context.playerAlive !== false;
    if (!player || !playerAlive) {
      if (this.state !== STATES.IDLE && this.state !== STATES.HIT) {
        this.enter(STATES.IDLE);
      }
      if (this.state === STATES.HIT) this.updateHit(dt);
      return;
    }

    const pos = this.character.root.position;
    const dx = player.x - pos.x;
    const dz = player.z - pos.z;
    const dist = Math.hypot(dx, dz);

    switch (this.state) {
      case STATES.IDLE:
        this.updateIdle(dist, context);
        break;
      case STATES.CHASE:
        this.updateChase(dt, dist, dx, dz, context);
        break;
      case STATES.ATTACK:
        this.updateAttack(dt, dist, context);
        break;
      case STATES.HIT:
        this.updateHit(dt);
        break;
      default:
        break;
    }
  }

  updateIdle(dist, context) {
    if (dist > (this.def.detectRange ?? 14)) return;

    if (this.def.requireLosToDetect !== false) {
      if (!this.canSeePlayer(context)) return;
    }

    this.alerted = true;
    this.enter(STATES.CHASE);
  }

  updateChase(dt, dist, dx, dz, context) {
    if (dist > (this.def.loseRange ?? 22)) {
      this.alerted = false;
      this.enter(STATES.IDLE);
      return;
    }

    const attackRange = this.def.attackRange ?? 12;
    if (dist <= attackRange && this.attackCooldown <= 0 && this.canSeePlayer(context)) {
      this.enter(STATES.ATTACK);
      return;
    }

    const speed = this.def.moveSpeed ?? 2.2;
    let moveX = 0;
    let moveZ = 0;
    if (dist > 0.05) {
      moveX = (dx / dist) * speed * dt;
      moveZ = (dz / dist) * speed * dt;
    }

    const beforeX = this.character.root.position.x;
    const beforeZ = this.character.root.position.z;
    moveCylinder(
      this.character.root.position,
      this.def.hitRadius ?? 0.4,
      moveX,
      moveZ,
      context.colliders ?? [],
      this.def.height ?? 1.8,
    );

    const moved = Math.hypot(
      this.character.root.position.x - beforeX,
      this.character.root.position.z - beforeZ,
    );

    // Unstick: strafe if blocked while trying to chase.
    if (moved < speed * dt * 0.15 && dist > 0.6) {
      this.strafeTimer = 0.35;
      this.strafeSign *= -1;
    }
    if (this.strafeTimer > 0) {
      this.strafeTimer -= dt;
      const sx = (-dz / Math.max(dist, 0.01)) * this.strafeSign * speed * dt;
      const sz = (dx / Math.max(dist, 0.01)) * this.strafeSign * speed * dt;
      moveCylinder(
        this.character.root.position,
        this.def.hitRadius ?? 0.4,
        sx,
        sz,
        context.colliders ?? [],
        this.def.height ?? 1.8,
      );
    }

    this.character.animator?.play('walk');
  }

  updateAttack(dt, dist, context) {
    this.windupTimer -= dt;
    if (this.windupTimer > 0) return;

    // Commit shot once windup completes.
    if (this.canSeePlayer(context) && dist <= (this.def.attackRange ?? 12) + 0.5) {
      this.fireAtPlayer(context);
    }

    this.attackCooldown = this.def.attackInterval ?? 1.1;
    this.enter(STATES.CHASE);
  }

  updateHit(dt) {
    this.hitTimer -= dt;
    if (this.hitTimer <= 0) {
      this.enter(this.alerted ? STATES.CHASE : STATES.IDLE);
    }
  }

  canSeePlayer(context) {
    const player = context.playerPosition;
    if (!player) return false;

    this._origin.set(
      this.character.root.position.x,
      (this.def.height ?? 1.8) * 0.7,
      this.character.root.position.z,
    );
    this._target.set(player.x, (context.playerEyeHeight ?? 1.7) * 0.7, player.z);
    return hasLineOfSight(this._origin, this._target, context.worldMeshes ?? [], 80);
  }

  fireAtPlayer(context) {
    const player = context.playerPosition;
    this._origin.set(
      this.character.root.position.x,
      (this.def.height ?? 1.8) * 0.7,
      this.character.root.position.z,
    );
    this._target.set(player.x, (context.playerEyeHeight ?? 1.7) * 0.7, player.z);

    if (!this.canSeePlayer(context)) return;

    const damage = this.def.attackDamage ?? 12;
    context.onEnemyAttack?.({
      damage,
      point: this._target.clone(),
      sourceId: this.character.id,
    });
  }
}
