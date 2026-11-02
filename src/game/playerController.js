import * as THREE from 'three';

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

    this.position = new THREE.Vector3().fromArray(playerConfig.spawnPosition ?? [0, 0, 0]);
    this.yaw = playerConfig.spawnYaw ?? 0;
    this.pitch = 0;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      fire: false,
    };

    this.isLocked = false;
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
    // Only fire when already locked so the lock-acquiring click does not shoot.
    if (event.button === 0 && this.isLocked) {
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
    if (!this.isLocked) return;
    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch -= event.movementY * this.lookSensitivity;
    const limit = Math.PI * 0.45;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  update(deltaSeconds) {
    if (this.isLocked) {
      // yaw 0 faces -Z (Three.js default camera forward).
      this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      this.wishDir.set(0, 0, 0);
      if (this.keys.forward) this.wishDir.add(this.forward);
      if (this.keys.back) this.wishDir.sub(this.forward);
      if (this.keys.right) this.wishDir.add(this.right);
      if (this.keys.left) this.wishDir.sub(this.right);

      if (this.wishDir.lengthSq() > 0) {
        this.wishDir.normalize().multiplyScalar(this.walkSpeed * deltaSeconds);
        this.moveWithCollision(this.wishDir.x, this.wishDir.z);
      }
    }

    this.syncCamera();
  }

  moveWithCollision(dx, dz) {
    this.position.x = this.resolveAxis(this.position.x + dx, this.position.z, 'x');
    this.position.z = this.resolveAxis(this.position.x, this.position.z + dz, 'z');
  }

  resolveAxis(x, z, axis) {
    let px = x;
    let pz = z;

    for (const box of this.colliders) {
      if (box.maxY < 0.2 || box.minY > this.eyeHeight) continue;

      const closestX = clamp(px, box.minX, box.maxX);
      const closestZ = clamp(pz, box.minZ, box.maxZ);
      const offsetX = px - closestX;
      const offsetZ = pz - closestZ;
      const distSq = offsetX * offsetX + offsetZ * offsetZ;
      const radius = this.radius;

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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
