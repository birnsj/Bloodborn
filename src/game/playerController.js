import * as THREE from 'three';
import { moveCylinder } from './collision/moveCylinder.js';

/**
 * First-person controller: pointer lock, WASD, mouse look, AABB collision.
 * Frame-rate independent. No jumping.
 */
export class PlayerController {
  constructor(camera, playerConfig, colliders, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.colliders = colliders;

    this.eyeHeight = playerConfig.eyeHeight ?? 1.7;
    this.radius = playerConfig.radius ?? 0.35;
    this.walkSpeed = playerConfig.walkSpeed ?? 4;
    this.lookSensitivity = playerConfig.lookSensitivity ?? 0.002;
    this.maxHealth = playerConfig.maxHealth ?? 100;

    this.spawnPosition = new THREE.Vector3().fromArray(
      playerConfig.spawnPosition ?? [0, 0, 0],
    );
    this.spawnYaw = playerConfig.spawnYaw ?? 0;

    this.position = this.spawnPosition.clone();
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.dead = false;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      fire: false,
    };

    this.isLocked = false;
    this.restartCallback = null;
    this.damageCallback = null;
    this.deathCallback = null;

    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);
    this._onMouseUp = this.onMouseUp.bind(this);
    this._onPointerLockChange = this.onPointerLockChange.bind(this);
    this._onClick = this.requestLock.bind(this);

    this.lockChangeCallback = null;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.wishDir = new THREE.Vector3();

    this.syncCamera();
  }

  setLockChangeCallback(cb) {
    this.lockChangeCallback = cb;
  }

  setRestartCallback(cb) {
    this.restartCallback = cb;
  }

  setDamageCallback(cb) {
    this.damageCallback = cb;
  }

  setDeathCallback(cb) {
    this.deathCallback = cb;
  }

  attach() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.domElement.addEventListener('click', this._onClick);
  }

  detach() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.domElement.removeEventListener('click', this._onClick);
    this.keys.fire = false;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  requestLock() {
    if (this.dead) return;
    if (document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock();
    }
  }

  onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (!this.isLocked) {
      this.keys.fire = false;
    }
    this.lockChangeCallback?.(this.isLocked);
  }

  onMouseDown(event) {
    if (event.button === 0 && this.isLocked && !this.dead) {
      this.keys.fire = true;
    }
  }

  onMouseUp(event) {
    if (event.button === 0) {
      this.keys.fire = false;
    }
  }

  onKeyDown(event) {
    if (event.code === 'Escape' && this.isLocked) {
      document.exitPointerLock();
      return;
    }

    if (event.code === 'KeyR' && this.dead) {
      this.restartCallback?.();
      return;
    }

    if (this.dead) return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      default:
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      default:
        break;
    }
  }

  onMouseMove(event) {
    if (!this.isLocked || this.dead) return;
    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch -= event.movementY * this.lookSensitivity;
    const limit = Math.PI * 0.45;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  applyDamage(amount) {
    if (this.dead || amount <= 0) {
      return { health: this.health, dead: this.dead };
    }
    this.health = Math.max(0, this.health - amount);
    this.damageCallback?.({ damage: amount, health: this.health });
    if (this.health <= 0) {
      this.die();
    }
    return { health: this.health, dead: this.dead };
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.keys.fire = false;
    this.keys.forward = false;
    this.keys.back = false;
    this.keys.left = false;
    this.keys.right = false;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
    this.deathCallback?.();
  }

  resetToSpawn() {
    this.position.copy(this.spawnPosition);
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.keys.fire = false;
    this.syncCamera();
  }

  update(deltaSeconds) {
    if (this.isLocked && !this.dead) {
      this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      this.wishDir.set(0, 0, 0);
      if (this.keys.forward) this.wishDir.add(this.forward);
      if (this.keys.back) this.wishDir.sub(this.forward);
      if (this.keys.right) this.wishDir.add(this.right);
      if (this.keys.left) this.wishDir.sub(this.right);

      if (this.wishDir.lengthSq() > 0) {
        this.wishDir.normalize().multiplyScalar(this.walkSpeed * deltaSeconds);
        moveCylinder(
          this.position,
          this.radius,
          this.wishDir.x,
          this.wishDir.z,
          this.colliders,
          this.eyeHeight,
        );
      }
    }

    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
