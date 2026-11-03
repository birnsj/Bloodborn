import * as THREE from 'three';
import { applyVertical, moveCylinderSlide } from '../collision/moveCylinder.js';
import { hasLineOfSight } from '../combat/raycast.js';

const STATES = {
  IDLE: 'idle',
  ALERT: 'alert',
  CHASE: 'chase',
  ATTACK: 'attack',
  HIT: 'hit',
  DEATH: 'death',
};

function lerpAngle(from, to, t) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

/**
 * Ranged billboard AI: combat band with smooth sideways walk + fire-while-strafing.
 * No navmesh — cylinder steering only.
 */
export class EnemyBrain {
  constructor(character, def) {
    this.character = character;
    this.def = def;
    this.state = STATES.IDLE;
    this.alerted = false;
    this.attackCooldown = 0;
    this.shotCommitted = false;
    this.strafeSign = 1;
    this.strafeTimer = 1.4;
    this.runDistance = def.runDistance ?? 8;
    this.preferRangeMin = def.preferRangeMin ?? 6;
    this.preferRangeMax = def.preferRangeMax ?? 11;
    this.searchTime = def.searchTime ?? 2.5;
    this._searchLeft = 0;
    this._attackElapsed = 0;
    this._context = null;
    this._lastSeen = null;
    this._locoClip = null;
    this._strafing = false;
    this._inBand = false;
    this._blockFrames = 0;
    this._strafeReversals = 0;

    this._origin = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  reset() {
    this.state = STATES.IDLE;
    this.alerted = false;
    this.attackCooldown = 0;
    this.shotCommitted = false;
    this.strafeTimer = 1.4;
    this.strafeSign = 1;
    this._attackElapsed = 0;
    this._searchLeft = 0;
    this._lastSeen = null;
    this._locoClip = null;
    this._strafing = false;
    this._inBand = false;
    this._blockFrames = 0;
    this._strafeReversals = 0;
    if (this.character.animator) {
      this.character.animator.forceMirror = null;
      this.character.animator.forceDir = null;
    }
    this.character.facingYaw = this.character.instanceDef.yaw ?? 0;
    this.character.animator?.play('idle', { force: true });
  }

  onDamaged() {
    if (this.character.dead) {
      this.enter(STATES.DEATH);
      return;
    }
    if (this.state === STATES.ATTACK) {
      this.attackCooldown = this.def.attackInterval ?? 1.1;
      this.shotCommitted = false;
      this._attackElapsed = 0;
    }
    this.enter(STATES.HIT);
  }

  onDeath() {
    this.enter(STATES.DEATH);
  }

  onAnimComplete(name) {
    if (this.state === STATES.ATTACK && (name === 'attack' || name === 'strafeAttack')) {
      this.attackCooldown = this.def.attackInterval ?? 1.1;
      this.shotCommitted = false;
      this._attackElapsed = 0;
      this.enter(STATES.CHASE);
      return;
    }
    if (this.state === STATES.HIT && name === 'hit') {
      this.enter(this.alerted ? STATES.CHASE : STATES.IDLE);
      return;
    }
    if (this.state === STATES.ALERT && name === 'alert') {
      this.enter(STATES.CHASE);
    }
  }

  onAnimEvent(evt) {
    if (this.state === STATES.ATTACK && evt?.name === 'fire' && this._context) {
      const player = this._context.playerPosition;
      if (!player) return;
      const pos = this.character.root.position;
      const dist = Math.hypot(player.x - pos.x, player.z - pos.z);
      this.commitShot(this._context, dist);
    }
  }

  enter(next) {
    if (this.state === STATES.DEATH && next !== STATES.DEATH) return;
    const prev = this.state;
    this.state = next;

    if (next === STATES.IDLE) {
      this._locoClip = null;
      this._inBand = false;
      this.clearStrafeFacing();
      this.character.animator?.play('idle');
    }
    if (next === STATES.ALERT) {
      this._locoClip = null;
      this.clearStrafeFacing();
      this.character.animator?.play('alert', { force: true });
    }
    if (next === STATES.CHASE) {
      // Don't hard-restart loco when returning from a strafing shot — avoids a pop.
      if (prev === STATES.ATTACK && (this._strafing || this._inBand)) {
        this.playStrafe(true);
      } else if (prev !== STATES.ATTACK) {
        this.clearStrafeFacing();
        this.playLoco(0, true);
      }
    }
    if (next === STATES.ATTACK) {
      this._locoClip = null;
      this.shotCommitted = false;
      this._attackElapsed = 0;
      // Use normal attack (side-view from move-aligned facing) — not the shuffle strafeAttack atlas.
      this.character.animator?.play('attack', { force: true });
    }
    if (next === STATES.HIT) {
      this._locoClip = null;
      this.clearStrafeFacing();
      this.character.animator?.play('hit', { force: true });
    }
    if (next === STATES.DEATH) {
      this._locoClip = null;
      this.clearStrafeFacing();
      this.character.animator?.play('death', { force: true });
    }
  }

  playLoco(dist = 0, force = false) {
    if (this.character.animator) {
      this.character.animator.forceMirror = null;
      this.character.animator.forceDir = null;
    }
    const hasRun = !!this.character.animator?.player?.clips?.run;
    const useRun = hasRun && dist >= this.runDistance;
    const name = useRun ? 'run' : 'walk';
    if (!force && this._locoClip === name) return;
    this._locoClip = name;
    this.character.animator?.play(name);
  }

  /**
   * Combat circle loco = walk played sideways (move-aligned facing → side frames).
   * The dedicated strafe atlas is a front-facing weight-shift shuffle — do not use it here.
   */
  playStrafe(force = false) {
    if (!force && this._locoClip === 'strafe:walk') return;
    this._locoClip = 'strafe:walk';
    this.character.animator?.play('walk');
  }

  clearStrafeFacing() {
    this._strafing = false;
    if (this.character.animator) {
      this.character.animator.forceMirror = null;
      this.character.animator.forceDir = null;
    }
  }

  facePlayer(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 0.05) return;
    const target = Math.atan2(dx, dz);
    this.character.facingYaw = lerpAngle(this.character.facingYaw, target, Math.min(1, dt * 10));
  }

  update(dt, context) {
    this._context = context;

    if (this.character.dead) {
      if (this.state !== STATES.DEATH) this.enter(STATES.DEATH);
      return;
    }

    if (this._previewLock) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const player = context.playerPosition;
    const playerAlive = context.playerAlive !== false;
    if (!player || !playerAlive) {
      if (this.state !== STATES.IDLE && this.state !== STATES.HIT && this.state !== STATES.DEATH) {
        this.enter(STATES.IDLE);
      }
      this.applyGrounding(dt, context);
      return;
    }

    const pos = this.character.root.position;
    const dx = player.x - pos.x;
    const dz = player.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const sees = this.canSeePlayer(context);

    if (sees) {
      this._lastSeen = { x: player.x, z: player.z };
      this._searchLeft = this.searchTime;
    } else if (this._searchLeft > 0) {
      this._searchLeft = Math.max(0, this._searchLeft - dt);
    }

    // Face the player unless actively strafing — strafe facing is set to the
    // lateral move yaw so the walk cycle reads as sideways, not a front shuffle.
    if (!this._strafing) {
      if (
        this.state === STATES.ALERT ||
        this.state === STATES.HIT ||
        this.state === STATES.CHASE ||
        this.state === STATES.ATTACK ||
        (this.state === STATES.IDLE && sees)
      ) {
        if (sees) this.facePlayer(dx, dz, dt);
        else if (this._lastSeen) {
          this.facePlayer(this._lastSeen.x - pos.x, this._lastSeen.z - pos.z, dt);
        }
      }
    }

    switch (this.state) {
      case STATES.IDLE:
        this.updateIdle(dist, context, sees);
        break;
      case STATES.ALERT:
        break;
      case STATES.CHASE:
        this.updateChase(dt, dist, dx, dz, context, sees);
        break;
      case STATES.ATTACK:
        this.updateAttack(dt, dist, dx, dz, context, sees);
        break;
      case STATES.HIT:
        break;
      default:
        break;
    }

    this.applyGrounding(dt, context);
  }

  applyGrounding(dt, context) {
    applyVertical(
      this.character.root.position,
      this.def.hitRadius ?? 0.4,
      context.colliders ?? [],
      dt,
    );
  }

  updateIdle(dist, context, sees) {
    if (dist > (this.def.detectRange ?? 14)) return;
    if (this.def.requireLosToDetect !== false && !sees) return;

    this.alerted = true;
    if (this.character.animator?.player?.clips?.alert) {
      this.enter(STATES.ALERT);
    } else {
      this.enter(STATES.CHASE);
    }
  }

  /** @returns {boolean} false if strafe should be abandoned (pinned on geometry). */
  applyStrafe(dt, dx, dz, context) {
    const speed = (this.def.moveSpeed ?? 2.2) * 1.05;
    const tDist = Math.hypot(dx, dz);
    if (tDist < 0.05) return true;

    const nx = dx / tDist;
    const nz = dz / tDist;

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeSign *= -1;
      this.strafeTimer = 1.4 + Math.random() * 0.8;
      this._blockFrames = 0;
      this._strafeReversals = 0;
    }

    const dirX = -nz * this.strafeSign;
    const dirZ = nx * this.strafeSign;
    // Face along move so the walk cycle is a true forward gait in profile.
    this.character.facingYaw = Math.atan2(dirX, dirZ);

    // No unique left walk/run clips — mirror5 flips the right-facing side art.
    // Screen-right must match the player's right (Y-up: cross(forward, up)).
    // Unmirrored side frames walk toward screen-right; mirror when moving left.
    const anim = this.character.animator;
    const cam = context.camera?.position;
    const pos = this.character.root.position;
    if (anim && cam) {
      const toCamX = cam.x - pos.x;
      const toCamZ = cam.z - pos.z;
      const len = Math.hypot(toCamX, toCamZ) || 1;
      // forward_cam_to_char = -toCam; right = cross(forward, up) = (toCamZ, -toCamX)
      const rightX = toCamZ / len;
      const rightZ = -toCamX / len;
      const alongRight = dirX * rightX + dirZ * rightZ;
      anim.forceDir = 'side';
      anim.forceMirror = alongRight < 0;
    } else if (anim) {
      anim.forceDir = 'side';
      anim.forceMirror = this.strafeSign < 0;
    }

    const moveX = dirX * speed * dt;
    const moveZ = dirZ * speed * dt;
    const player = context.playerPosition;

    const moved = moveCylinderSlide(
      this.character.root.position,
      this.def.hitRadius ?? 0.4,
      moveX,
      moveZ,
      context.colliders ?? [],
      this.def.height ?? 1.8,
      player?.x,
      player?.z,
    );

    if (moved < speed * dt * 0.15) {
      this._blockFrames += 1;
      if (this._blockFrames >= 4) {
        this.strafeSign *= -1;
        this.strafeTimer = 1.0 + Math.random() * 0.5;
        this._blockFrames = 0;
        this._strafeReversals += 1;

        // Both lateral directions blocked (pillars / hallway) — leave the band.
        if (this._strafeReversals >= 2) {
          this._strafeReversals = 0;
          this._inBand = false;
          this.clearStrafeFacing();
          return false;
        }

        const rx = -nz * this.strafeSign;
        const rz = nx * this.strafeSign;
        this.character.facingYaw = Math.atan2(rx, rz);
        if (anim && cam) {
          const toCamX = cam.x - pos.x;
          const toCamZ = cam.z - pos.z;
          const len = Math.hypot(toCamX, toCamZ) || 1;
          const alongRight = rx * (toCamZ / len) + rz * (-toCamX / len);
          anim.forceDir = 'side';
          anim.forceMirror = alongRight < 0;
        }
        const movedBack = moveCylinderSlide(
          this.character.root.position,
          this.def.hitRadius ?? 0.4,
          rx * speed * dt,
          rz * speed * dt,
          context.colliders ?? [],
          this.def.height ?? 1.8,
          player?.x,
          player?.z,
        );
        if (movedBack < speed * dt * 0.15) {
          this._strafeReversals = 0;
          this._inBand = false;
          this.clearStrafeFacing();
          return false;
        }
      }
    } else {
      this._blockFrames = 0;
      this._strafeReversals = 0;
    }
    return true;
  }

  updateChase(dt, dist, dx, dz, context, sees) {
    if (dist > (this.def.loseRange ?? 22) && this._searchLeft <= 0) {
      this.alerted = false;
      this._lastSeen = null;
      this.enter(STATES.IDLE);
      return;
    }

    const bandMin = this.preferRangeMin;
    const bandMax = Math.min(this.preferRangeMax, this.def.attackRange ?? 12);
    // Hysteresis so he doesn't flicker approach ↔ strafe ↔ backpedal on the edge.
    const enterPad = 0.35;
    const exitPad = 0.85;
    if (this._inBand) {
      if (!sees || dist < bandMin - exitPad || dist > bandMax + exitPad) {
        this._inBand = false;
        this.clearStrafeFacing();
      }
    } else if (sees && dist >= bandMin - enterPad && dist <= bandMax + enterPad) {
      this._inBand = true;
    }

    const inAttackReach =
      sees && dist <= (this.def.attackRange ?? 12) && dist >= bandMin * 0.85;
    if (inAttackReach && this.attackCooldown <= 0) {
      this._strafing = this._inBand;
      this.enter(STATES.ATTACK);
      if (this._strafing) {
        const ok = this.applyStrafe(dt, dx, dz, context);
        if (!ok) this.clearStrafeFacing();
      }
      return;
    }

    const speed = this.def.moveSpeed ?? 2.2;
    let tx = dx;
    let tz = dz;
    let tDist = dist;
    if (!sees && this._lastSeen) {
      tx = this._lastSeen.x - this.character.root.position.x;
      tz = this._lastSeen.z - this.character.root.position.z;
      tDist = Math.hypot(tx, tz);
      if (tDist < 0.6 && this._searchLeft <= 0) {
        this.alerted = false;
        this._lastSeen = null;
        this.enter(STATES.IDLE);
        return;
      }
    }

    if (this._inBand && sees) {
      this._strafing = true;
      const ok = this.applyStrafe(dt, dx, dz, context);
      if (ok) {
        this.playStrafe();
        return;
      }
      // Pinned — fall through to direct chase/backpedal this frame.
    }

    this._strafing = false;

    if (tDist > 0.05) {
      const nx = tx / tDist;
      const nz = tz / tDist;
      let moveX = 0;
      let moveZ = 0;

      if (sees && dist < bandMin) {
        moveX = -nx * speed * dt;
        moveZ = -nz * speed * dt;
      } else {
        moveX = nx * speed * dt;
        moveZ = nz * speed * dt;
      }

      const goalX = sees
        ? this.character.root.position.x + tx
        : this._lastSeen?.x ?? this.character.root.position.x + tx;
      const goalZ = sees
        ? this.character.root.position.z + tz
        : this._lastSeen?.z ?? this.character.root.position.z + tz;

      moveCylinderSlide(
        this.character.root.position,
        this.def.hitRadius ?? 0.4,
        moveX,
        moveZ,
        context.colliders ?? [],
        this.def.height ?? 1.8,
        goalX,
        goalZ,
      );
      this.playLoco(sees ? dist : tDist);
    } else {
      this._locoClip = null;
      this.character.animator?.play('idle');
    }
  }

  updateAttack(dt, dist, dx, dz, context, sees) {
    // Keep lateral walk + side facing through the shot.
    if (this._strafing && sees) {
      const ok = this.applyStrafe(dt, dx, dz, context);
      if (!ok) this.clearStrafeFacing();
    }

    if (!this.shotCommitted) {
      this._attackElapsed += dt;
      const clip = this.character.animator?.player?.clips?.attack;
      const hasFireEvent = clip?.events?.some((e) => e.name === 'fire');
      if (!hasFireEvent && this._attackElapsed >= (this.def.attackWindup ?? 0.25)) {
        this.commitShot(context, dist);
      }
    }
  }

  commitShot(context, dist) {
    if (this.shotCommitted) return;
    this.shotCommitted = true;
    if (this.canSeePlayer(context) && dist <= (this.def.attackRange ?? 12) + 0.5) {
      this.fireAtPlayer(context);
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
    this._target.set(player.x, (context.playerEyeHeight ?? 1.7) * 0.7, player.z);
    if (!this.canSeePlayer(context)) return;
    context.onEnemyAttack?.({
      damage: this.def.attackDamage ?? 12,
      point: this._target.clone(),
      sourceId: this.character.id,
    });
  }
}
