import * as THREE from 'three';

/**
 * Simple first-person pistol viewmodel (camera child).
 * Plain boxes + cylinders — readable gun, no capsule blobs.
 */
export class WeaponViewModel {
  constructor(camera, weaponDef) {
    this.camera = camera;
    this.def = weaponDef;
    this.view = weaponDef.view ?? {};

    this.root = new THREE.Group();
    this.root.name = 'weapon_viewmodel';
    this.pose = new THREE.Group();
    this.root.add(this.pose);
    this.gun = new THREE.Group();
    this.pose.add(this.gun);

    this.slide = null;
    this.muzzleFlash = null;
    this.muzzlePoint = new THREE.Object3D();
    this._flashLight = null;

    this._eventHandler = null;
    this._clip = 'idle';
    this._clipT = 0;
    this._clipDur = 0;
    this._clipLoop = true;
    this._finished = false;
    this._pendingReload = false;
    this.shotsSinceReload = 0;
    this.reloadEvery = this.view.reloadEvery ?? 8;

    this.bobPhase = 0;
    this.swayPhase = 0;
    this.bobActive = false;
    this._kick = 0;
    this._slide = 0;
    this._pump = 0;
    this._dy = 0;
    this._flash = 0;

    // Classic FP hold — overridable via view.pose / numpad tune.
    // Supports position/rotation arrays or legacy x/y/distance/pitch/yaw/roll.
    const pose = this.view.pose ?? {};
    const pos = pose.position ?? [
      pose.x ?? 0.18,
      pose.y ?? -0.18,
      pose.distance != null ? -pose.distance : -0.36,
    ];
    const rot = pose.rotation ?? [
      pose.pitch ?? 0.48,
      pose.yaw ?? 0.1,
      pose.roll ?? 0.05,
    ];
    this._basePos = new THREE.Vector3(pos[0], pos[1], pos[2]);
    this._baseRot = new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ');
    this._holdScale = pose.scale ?? 1;
    this._owned = [];

    this.player = {
      get current() {
        return this._owner._clip;
      },
      get finished() {
        return this._owner._finished;
      },
      clips: { idle: {}, walk: {}, fire: {}, recoil: {}, reload: {}, equip: {}, lower: {} },
      play: (name) => this._owner._playClip(name),
      _owner: this,
    };

    this._light = new THREE.PointLight(0xffe2c0, 0.4, 1.5, 2);
    this._light.position.set(0.05, 0.08, 0.1);
    this.root.add(this._light);

    this.camera.add(this.root);
  }

  static async create(camera, weaponDef) {
    const view = new WeaponViewModel(camera, weaponDef);
    view.build();
    view.playEquip();
    return view;
  }

  setEventHandler(handler) {
    this._eventHandler = handler;
  }

  /** World-space muzzle tip for tracers / lighting. */
  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    if (!this.muzzlePoint) return target.set(0, 0, 0);
    this.muzzlePoint.updateWorldMatrix(true, false);
    return this.muzzlePoint.getWorldPosition(target);
  }

  layout() {}

  build() {
    const metal = this.mat(0x3a3a40);
    const dark = this.mat(0x1a1a1e);
    const slideMat = this.mat(0x4a4a52);
    const gripMat = this.mat(0x2a2218);
    const sight = this.mat(0x111114);
    const skin = this.mat(0xe0b890, { metalness: 0.02, roughness: 0.75 });
    const sleeve = this.mat(0x3a2a20, { metalness: 0.05, roughness: 0.85 });

    // Model in +Z-forward space (muzzle = +Z), then yaw 180° so it faces
    // camera forward (-Z). Grip hangs -Y.
    this.addBox(this.gun, [0, 0.01, 0], [0.028, 0.036, 0.1], metal);

    this.slide = new THREE.Group();
    this.gun.add(this.slide);
    this._slideBase = new THREE.Vector3(0, 0.026, 0.01);
    this.slide.position.copy(this._slideBase);
    this.addBox(this.slide, [0, 0, 0], [0.03, 0.02, 0.12], slideMat);
    this.addBox(this.slide, [0, 0.014, 0.05], [0.006, 0.008, 0.012], sight);
    this.addBox(this.slide, [0, 0.014, -0.05], [0.012, 0.008, 0.006], sight);

    this.addCyl(this.gun, [0, 0.016, 0.075], 0.007, 0.045, dark, 'z');

    this.addBox(this.gun, [0, -0.02, -0.01], [0.012, 0.016, 0.026], dark);
    this.addBox(this.gun, [0, -0.018, -0.005], [0.005, 0.012, 0.006], metal);

    this.addBox(this.gun, [0, -0.05, -0.03], [0.026, 0.072, 0.036], gripMat);
    this.addBox(this.gun, [0.014, -0.05, -0.03], [0.003, 0.06, 0.03], dark);
    this.addBox(this.gun, [-0.014, -0.05, -0.03], [0.003, 0.06, 0.03], dark);

    // Muzzle flash — star at barrel tip
    this.muzzlePoint.position.set(0, 0.016, 0.105);
    this.gun.add(this.muzzlePoint);

    this.muzzleFlash = new THREE.Group();
    this.muzzlePoint.add(this.muzzleFlash);
    this.muzzleFlash.visible = false;

    const flashOuter = this.mat(0xff9020, { emissive: 0xff6010, emissiveIntensity: 3.5 });
    const flashCore = this.mat(0xfff6c8, { emissive: 0xffe090, emissiveIntensity: 5 });
    // Cross flares
    this.addBox(this.muzzleFlash, [0, 0, 0.01], [0.09, 0.012, 0.012], flashOuter);
    this.addBox(this.muzzleFlash, [0, 0, 0.01], [0.012, 0.09, 0.012], flashOuter);
    this.addBox(this.muzzleFlash, [0, 0, 0.02], [0.05, 0.05, 0.02], flashOuter);
    this.addBox(this.muzzleFlash, [0, 0, 0.015], [0.028, 0.028, 0.028], flashCore);

    this._flashLight = new THREE.PointLight(0xffa040, 0, 1.2, 2);
    this.muzzlePoint.add(this._flashLight);

    // 180° yaw → muzzle faces camera -Z. Root pitch tips barrel up.
    this.gun.rotation.order = 'YXZ';
    this.gun.rotation.set(0.08, Math.PI + 0.14, 0.04);
    this.gun.scale.setScalar(1.35);

    // Arm in pose space — comes from BR edge up into the grip.
    this.arm = new THREE.Group();
    this.pose.add(this.arm);
    this.addBox(this.arm, [0.1, -0.12, 0.06], [0.06, 0.055, 0.18], sleeve);
    this.addBox(this.arm, [0.07, -0.08, 0.0], [0.055, 0.05, 0.08], sleeve);
    this.addBox(this.arm, [0.04, -0.055, -0.04], [0.05, 0.045, 0.06], skin);
    this.addBox(this.arm, [0.015, -0.05, -0.03], [0.04, 0.03, 0.045], skin);
    this.addBox(this.arm, [0.035, -0.025, -0.02], [0.025, 0.028, 0.045], skin);

    this._applyRestPose();
  }

  mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: opts.metalness ?? 0.35,
      roughness: opts.roughness ?? 0.55,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
    this._owned.push(m);
    return m;
  }

  addBox(parent, pos, size, material) {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    this._owned.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    parent.add(mesh);
    return mesh;
  }

  addCyl(parent, pos, radius, length, material, axis = 'z') {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 10);
    this._owned.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    parent.add(mesh);
    return mesh;
  }

  _applyRestPose() {
    this.root.position.copy(this._basePos);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.copy(this._baseRot);
    this.root.scale.setScalar(this._holdScale);
    this.pose.position.set(0, 0, 0);
    this.pose.rotation.set(0, 0, 0);
  }

  /** Authoring helpers — base hold pose (before bob/kick animation). */
  getPose() {
    const round = (v) => Math.round(v * 1000) / 1000;
    return {
      position: [this._basePos.x, this._basePos.y, this._basePos.z].map(round),
      rotation: [this._baseRot.x, this._baseRot.y, this._baseRot.z].map(round),
      scale: round(this._holdScale),
    };
  }

  setPose(pose) {
    if (!pose) return this.getPose();
    if (pose.position) {
      this._basePos.fromArray(pose.position);
    } else {
      if (pose.x != null) this._basePos.x = Number(pose.x);
      if (pose.y != null) this._basePos.y = Number(pose.y);
      if (pose.distance != null) this._basePos.z = -Number(pose.distance);
      if (pose.z != null) this._basePos.z = Number(pose.z);
    }
    if (pose.rotation) {
      this._baseRot.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'YXZ');
    } else {
      if (pose.pitch != null) this._baseRot.x = Number(pose.pitch);
      if (pose.yaw != null) this._baseRot.y = Number(pose.yaw);
      if (pose.roll != null) this._baseRot.z = Number(pose.roll);
    }
    if (pose.scale != null) this._holdScale = Number(pose.scale);
    this._applyRestPose();
    return this.getPose();
  }

  /** Slider-friendly rest pose; distance is positive units in front of camera. */
  getTunePose() {
    return {
      x: this._basePos.x,
      y: this._basePos.y,
      distance: -this._basePos.z,
      pitch: this._baseRot.x,
    };
  }

  nudgePos(dx, dy, dz) {
    this._basePos.x += dx;
    this._basePos.y += dy;
    this._basePos.z += dz;
    this._applyRestPose();
  }

  nudgeRot(dpitch, dyaw, droll) {
    this._baseRot.x += dpitch;
    this._baseRot.y += dyaw;
    this._baseRot.z += droll;
    this._applyRestPose();
  }

  _playClip(name, { dur, loop = false } = {}) {
    const durations = {
      idle: 0.8,
      walk: 0.4,
      fire: 0.18,
      recoil: 0.22,
      reload: 0.65,
      equip: 0.3,
      lower: 0.3,
    };
    this._clip = name;
    this._clipT = 0;
    this._clipDur = dur ?? durations[name] ?? 0.4;
    this._clipLoop = loop;
    this._finished = false;
    if (name === 'fire') {
      this._flash = 1;
      this._eventHandler?.({ name: 'muzzle', clip: 'fire' });
      this._eventHandler?.({ name: 'fire', clip: 'fire' });
    }
    return true;
  }

  playFire() {
    this._playClip('fire');
    this.shotsSinceReload += 1;
    if (this.shotsSinceReload >= this.reloadEvery) this._pendingReload = true;
  }

  playReload() {
    this.shotsSinceReload = 0;
    this._pendingReload = false;
    return this._playClip('reload');
  }

  playEquip() {
    this._pendingReload = false;
    this.shotsSinceReload = 0;
    return this._playClip('equip');
  }

  playLower() {
    return this._playClip('lower');
  }

  playIdle() {
    return this._playClip('idle', { loop: true });
  }

  update(dt, _viewport = {}, { moving = false, playerDead = false } = {}) {
    if (playerDead && this._clip !== 'lower') this.playLower();

    const busy = ['fire', 'recoil', 'reload', 'equip', 'lower'].includes(this._clip);
    if (!playerDead && !busy) {
      if (moving) {
        if (this._clip !== 'walk') this._playClip('walk', { loop: true });
        this.bobActive = true;
      } else {
        if (this._clip === 'walk') this.playIdle();
        this.bobActive = false;
        if (this._clip === 'idle') this.swayPhase += dt * (this.view.swaySpeed ?? 1.5);
      }
    } else this.bobActive = false;

    if (this.bobActive) this.bobPhase += dt * (this.view.bobSpeed ?? 10);
    else this.bobPhase *= 0.9;

    this._clipT += dt;
    const u = this._clipDur > 0 ? Math.min(1, this._clipT / this._clipDur) : 1;
    this._evalPose(this._clip, u);

    if (!this._finished && u >= 1) {
      if (this._clipLoop) this._clipT = 0;
      else {
        this._finished = true;
        this._onClipFinished();
      }
    }
    this._applyPoseTransforms();
  }

  _onClipFinished() {
    if (this._clip === 'fire') {
      if (this._pendingReload) this.playReload();
      else this._playClip('recoil');
      return;
    }
    if (this._clip === 'recoil') {
      if (this._pendingReload) this.playReload();
      else this.playIdle();
      return;
    }
    if (this._clip === 'reload' || this._clip === 'equip') this.playIdle();
  }

  _evalPose(clip, u) {
    const ease = u * u * (3 - 2 * u);
    this._flash = 0;
    this._pump = 0;

    if (clip === 'idle') {
      const w = Math.sin(this._clipT * Math.PI * 2 * 1.2);
      this._kick = 0.002 + w * 0.0015;
      this._slide = Math.sin(this._clipT * 1.0) * 0.001;
      this._dy = 0;
    } else if (clip === 'walk') {
      const w = Math.sin(this.bobPhase);
      this._kick = 0.005 + Math.abs(w) * 0.008;
      this._slide = w * 0.008;
      this._dy = 0;
    } else if (clip === 'fire') {
      if (u < 0.18) {
        this._kick = 0.012;
        this._pump = 0.012;
        this._flash = 1; // full muzzle flash on the first frames
      } else if (u < 0.45) {
        this._kick = 0.032;
        this._pump = 0.018;
        this._slide = -0.004;
        this._flash = Math.max(0, 1 - (u - 0.18) / 0.2);
      } else {
        this._kick = 0.032 * (1 - ease);
        this._pump = 0.018 * (1 - ease);
        this._slide = -0.002 * (1 - ease);
        this._flash = 0;
      }
      this._dy = 0;
    } else if (clip === 'recoil') {
      this._kick = 0.02 * (1 - ease);
      this._pump = 0;
      this._slide = 0;
      this._dy = 0;
    } else if (clip === 'reload') {
      this._kick = 0.006;
      this._slide = -0.006;
      this._pump = u < 0.5 ? u * 0.02 : (1 - u) * 0.02;
      this._dy = 0.004;
    } else if (clip === 'equip') {
      this._kick = 0;
      this._slide = 0;
      this._dy = (1 - ease) * 0.1;
    } else if (clip === 'lower') {
      this._kick = 0;
      this._slide = 0;
      this._dy = ease * 0.12;
    } else {
      this._kick = 0;
      this._slide = 0;
      this._dy = 0;
    }
  }

  _applyPoseTransforms() {
    const bobAmp = (this.view.bobAmplitude ?? 6) * 0.00055;
    const swayAmp = (this.view.swayAmplitude ?? 2) * 0.00045;
    const bobX = this.bobActive ? Math.sin(this.bobPhase) * bobAmp * 0.35 : 0;
    const bobY = this.bobActive ? Math.abs(Math.sin(this.bobPhase)) * bobAmp : 0;
    const swayX = !this.bobActive ? Math.sin(this.swayPhase) * swayAmp : 0;
    const swayY = !this.bobActive ? Math.cos(this.swayPhase * 0.7) * swayAmp * 0.4 : 0;

    this.pose.position.set(
      this._slide + bobX + swayX,
      -this._kick - this._dy + bobY + swayY,
      this._kick * 0.25,
    );
    this.pose.rotation.set(-this._kick * 1.4, this._slide * 0.5, this._slide * 0.25);

    if (this.slide && this._slideBase) {
      // Rack slide rearward (−Z in model space) when firing
      this.slide.position.set(
        this._slideBase.x,
        this._slideBase.y,
        this._slideBase.z - this._pump,
      );
    }

    if (this.muzzleFlash) {
      const on = this._flash > 0.05;
      this.muzzleFlash.visible = on;
      if (on) {
        const s = 0.85 + this._flash * 0.7 + Math.random() * 0.15;
        this.muzzleFlash.scale.setScalar(s);
        this.muzzleFlash.rotation.z = Math.random() * Math.PI;
      }
    }
    if (this._flashLight) {
      this._flashLight.intensity = this._flash > 0.05 ? 2.8 * this._flash : 0;
    }
  }

  destroy() {
    this.camera?.remove(this.root);
    this.root.traverse((obj) => obj.geometry?.dispose?.());
    for (const item of this._owned) item.dispose?.();
    this._owned.length = 0;
  }
}
