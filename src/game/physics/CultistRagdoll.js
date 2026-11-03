import * as THREE from 'three';

/**
 * Capsule/box ragdoll driven by Rapier. Visuals are separate from the animated model.
 * Activate on death with an impulse so the body is knocked over by the shot.
 */
export class CultistRagdoll {
  constructor(physics, scene, { height = 2.0, materials = {} } = {}) {
    this.physics = physics;
    this.RAPIER = physics.RAPIER;
    this.world = physics.world;
    this.scene = scene;
    this.height = height;
    this.u = height / 1.75;
    this.active = false;
    this.root = new THREE.Group();
    this.root.name = 'cultist_ragdoll';
    this.scene.add(this.root);

    this.bodies = {};
    this.visuals = {};
    this.joints = [];
    this._owned = [];
    this.settled = false;
    this._age = 0;
    this._stillTime = 0;

    this.matRobe = materials.robe ?? this._mat(0x2a1c28);
    this.matRobeDk = materials.robeDk ?? this._mat(0x1a1018);
    this.matSkin = materials.skin ?? this._mat(0xc4a078);
    this.matHood = materials.hood ?? this._mat(0x241820);
    this.matBoot = materials.boots ?? this._mat(0x1a1218);
  }

  _mat(color) {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.12,
      roughness: 0.75,
    });
    this._owned.push(m);
    return m;
  }

  _addVisualBox(name, size, material) {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    this._owned.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.visuals[name] = mesh;
    return mesh;
  }

  _addVisualCapsule(name, radius, length, material) {
    // Cylinder along Y; length is full height excluding hemispheres approx.
    const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, length), 4, 8);
    this._owned.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.visuals[name] = mesh;
    return mesh;
  }

  _createBody(name, translation, rotation, colliderDesc, mass) {
    const R = this.RAPIER;
    const rbDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(translation.x, translation.y, translation.z)
      .setCanSleep(true)
      .setLinearDamping(0.55)
      .setAngularDamping(0.85)
      .setCcdEnabled(true);
    if (rotation) rbDesc.setRotation(rotation);
    const body = this.world.createRigidBody(rbDesc);
    colliderDesc.setMass(mass).setFriction(1.05).setRestitution(0);
    this.world.createCollider(colliderDesc, body);
    this.bodies[name] = body;
    return body;
  }

  _jointSpherical(a, b, anchorA, anchorB) {
    const R = this.RAPIER;
    const data = R.JointData.spherical(anchorA, anchorB);
    const joint = this.world.createImpulseJoint(data, a, b, true);
    this.joints.push(joint);
    return joint;
  }

  /**
   * Build ragdoll at the character's current world pose and knock it with impulse.
   * @param {THREE.Object3D} modelRoot animated cultist root (world-updated)
   * @param {{ x:number,y:number,z:number }} impulse world-space impulse
   * @param {{ x:number,y:number,z:number }|null} hitPoint optional world hit point
   */
  activate(modelRoot, impulse, hitPoint = null) {
    this.disposeBodies();
    this.active = true;
    this.settled = false;
    this._age = 0;
    this._stillTime = 0;
    this.root.visible = true;

    modelRoot.updateWorldMatrix(true, true);
    const u = this.u;
    const R = this.RAPIER;

    const hipsWP = new THREE.Vector3();
    const torsoWP = new THREE.Vector3();
    const headWP = new THREE.Vector3();
    modelRoot.getWorldPosition(hipsWP); // fallback
    // Prefer joints if present on CultistModel via userData sampling from world matrix of named paths
    const sample = (obj, target) => {
      if (!obj) return target.copy(hipsWP);
      obj.getWorldPosition(target);
      return target;
    };

    // Caller passes model; we read CultistModel joints if available on parent CharacterInstance
    const model = modelRoot.userData?.cultistModel ?? null;
    const hipsObj = model?.hips ?? modelRoot;
    const torsoObj = model?.torso ?? modelRoot;
    const headObj = model?.headRoot ?? modelRoot;

    sample(hipsObj, hipsWP);
    sample(torsoObj, torsoWP);
    sample(headObj, headWP);
    // Chest sits above hips
    if (!model?.torso) {
      torsoWP.set(hipsWP.x, hipsWP.y + 0.4 * u, hipsWP.z);
      headWP.set(hipsWP.x, hipsWP.y + 0.85 * u, hipsWP.z);
    }

    const qRoot = new THREE.Quaternion();
    modelRoot.getWorldQuaternion(qRoot);
    const rot = { x: qRoot.x, y: qRoot.y, z: qRoot.z, w: qRoot.w };

    // Hips
    this._addVisualBox('hips', [0.34 * u, 0.22 * u, 0.2 * u], this.matRobe);
    this._createBody(
      'hips',
      hipsWP,
      rot,
      R.ColliderDesc.cuboid(0.17 * u, 0.11 * u, 0.1 * u),
      3.5,
    );

    // Torso
    const torsoPos = {
      x: torsoWP.x,
      y: torsoWP.y + 0.22 * u,
      z: torsoWP.z,
    };
    this._addVisualBox('torso', [0.36 * u, 0.48 * u, 0.22 * u], this.matRobe);
    this._createBody(
      'torso',
      torsoPos,
      rot,
      R.ColliderDesc.cuboid(0.18 * u, 0.24 * u, 0.11 * u),
      4.5,
    );

    // Head
    const headPos = { x: headWP.x, y: headWP.y + 0.12 * u, z: headWP.z };
    this._addVisualBox('head', [0.24 * u, 0.28 * u, 0.24 * u], this.matHood);
    this._createBody(
      'head',
      headPos,
      rot,
      R.ColliderDesc.cuboid(0.12 * u, 0.14 * u, 0.12 * u),
      1.2,
    );

    const thighLen = 0.42 * u;
    const shinLen = 0.42 * u;
    const upperLen = 0.32 * u;
    const foreLen = 0.3 * u;

    const sideSign = [1, -1];
    for (let i = 0; i < 2; i += 1) {
      const side = sideSign[i];
      const tag = side > 0 ? 'L' : 'R';

      const localHip = new THREE.Vector3(side * 0.1 * u, -0.15 * u, 0).applyQuaternion(qRoot);
      const thighPos = {
        x: hipsWP.x + localHip.x,
        y: hipsWP.y + localHip.y - thighLen * 0.35,
        z: hipsWP.z + localHip.z,
      };
      this._addVisualCapsule(`thigh${tag}`, 0.075 * u, thighLen * 0.7, this.matRobeDk);
      this._createBody(
        `thigh${tag}`,
        thighPos,
        rot,
        R.ColliderDesc.capsule(thighLen * 0.28, 0.07 * u),
        2.2,
      );

      const shinPos = {
        x: thighPos.x,
        y: thighPos.y - thighLen * 0.75,
        z: thighPos.z,
      };
      this._addVisualCapsule(`shin${tag}`, 0.065 * u, shinLen * 0.7, this.matRobe);
      this._createBody(
        `shin${tag}`,
        shinPos,
        rot,
        R.ColliderDesc.capsule(shinLen * 0.28, 0.06 * u),
        1.6,
      );

      const localShoulder = new THREE.Vector3(side * 0.22 * u, 0.35 * u, 0).applyQuaternion(qRoot);
      const upperPos = {
        x: torsoPos.x + localShoulder.x,
        y: torsoPos.y + localShoulder.y - upperLen * 0.2,
        z: torsoPos.z + localShoulder.z,
      };
      this._addVisualCapsule(`upper${tag}`, 0.055 * u, upperLen * 0.65, this.matRobeDk);
      this._createBody(
        `upper${tag}`,
        upperPos,
        rot,
        R.ColliderDesc.capsule(upperLen * 0.25, 0.05 * u),
        1.4,
      );

      const forePos = {
        x: upperPos.x,
        y: upperPos.y - upperLen * 0.7,
        z: upperPos.z,
      };
      this._addVisualCapsule(`fore${tag}`, 0.048 * u, foreLen * 0.6, this.matSkin);
      this._createBody(
        `fore${tag}`,
        forePos,
        rot,
        R.ColliderDesc.capsule(foreLen * 0.22, 0.045 * u),
        1.0,
      );
    }

    // Joints (anchors in local body space)
    const hips = this.bodies.hips;
    const torso = this.bodies.torso;
    const head = this.bodies.head;

    this._jointSpherical(hips, torso, { x: 0, y: 0.12 * u, z: 0 }, { x: 0, y: -0.24 * u, z: 0 });
    this._jointSpherical(torso, head, { x: 0, y: 0.28 * u, z: 0 }, { x: 0, y: -0.12 * u, z: 0 });

    for (const tag of ['L', 'R']) {
      const side = tag === 'L' ? 1 : -1;
      this._jointSpherical(
        hips,
        this.bodies[`thigh${tag}`],
        { x: side * 0.1 * u, y: -0.08 * u, z: 0 },
        { x: 0, y: 0.18 * u, z: 0 },
      );
      this._jointSpherical(
        this.bodies[`thigh${tag}`],
        this.bodies[`shin${tag}`],
        { x: 0, y: -0.2 * u, z: 0 },
        { x: 0, y: 0.2 * u, z: 0 },
      );
      this._jointSpherical(
        torso,
        this.bodies[`upper${tag}`],
        { x: side * 0.2 * u, y: 0.18 * u, z: 0 },
        { x: 0, y: 0.14 * u, z: 0 },
      );
      this._jointSpherical(
        this.bodies[`upper${tag}`],
        this.bodies[`fore${tag}`],
        { x: 0, y: -0.16 * u, z: 0 },
        { x: 0, y: 0.14 * u, z: 0 },
      );
    }

    // Apply shot impulse — main hit on torso/hips, smaller on nearby limbs.
    const imp = impulse ?? { x: 0, y: 2, z: -8 };
    const point = hitPoint ?? torsoPos;
    torso.applyImpulseAtPoint(imp, point, true);
    hips.applyImpulse(
      { x: imp.x * 0.55, y: Math.max(2.5, imp.y * 0.4) + 3, z: imp.z * 0.55 },
      true,
    );
    head.applyImpulse({ x: imp.x * 0.25, y: imp.y * 0.2, z: imp.z * 0.25 }, true);

    // Spin from off-center hits
    const torque = {
      x: (Math.random() - 0.5) * 1.5,
      y: (Math.random() - 0.5) * 2.5,
      z: (Math.random() - 0.5) * 1.5,
    };
    torso.applyTorqueImpulse(torque, true);

    this.physics.registerRagdoll(this);
    this.syncFromPhysics();
  }

  /**
   * Ramp damping after the hit, then freeze once motion dies out on the floor.
   */
  tickSettle(dt) {
    if (!this.active || this.settled) return;
    this._age += dt;

    let maxSpeed = 0;
    let maxSpin = 0;
    let nearFloor = false;
    for (const body of Object.values(this.bodies)) {
      const lv = body.linvel();
      const av = body.angvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const spin = Math.hypot(av.x, av.y, av.z);
      if (speed > maxSpeed) maxSpeed = speed;
      if (spin > maxSpin) maxSpin = spin;
      if (body.translation().y < 0.55) nearFloor = true;
    }

    // After the initial knock, bleed energy so he doesn't skate forever.
    if (this._age > 0.25) {
      const damp = 0.8 + Math.min(5, this._age * 1.6);
      const angDamp = 1.1 + Math.min(6, this._age * 1.8);
      for (const body of Object.values(this.bodies)) {
        body.setLinearDamping(damp);
        body.setAngularDamping(angDamp);
      }
    }

    const quiet = maxSpeed < 0.45 && maxSpin < 1.2;
    if (quiet && (nearFloor || this._age > 1.2)) this._stillTime += dt;
    else this._stillTime = 0;

    if (this._stillTime > 0.35 || this._age > 5) {
      this.freeze();
    }
  }

  /** Lock pose in place once settled on the floor. */
  freeze() {
    if (this.settled || !this.active) return;
    this.settled = true;
    const R = this.RAPIER;
    for (const body of Object.values(this.bodies)) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setBodyType(R.RigidBodyType.Fixed, true);
      body.sleep();
    }
  }

  syncFromPhysics() {
    if (!this.active) return;
    for (const [name, body] of Object.entries(this.bodies)) {
      const mesh = this.visuals[name];
      if (!mesh || !body) continue;
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  disposeBodies() {
    this.physics.unregisterRagdoll(this);
    for (const joint of this.joints) {
      this.world.removeImpulseJoint(joint, true);
    }
    this.joints.length = 0;
    for (const body of Object.values(this.bodies)) {
      this.world.removeRigidBody(body);
    }
    this.bodies = {};
    for (const mesh of Object.values(this.visuals)) {
      this.root.remove(mesh);
      mesh.geometry?.dispose?.();
    }
    this.visuals = {};
    this.active = false;
    this.settled = false;
    this._age = 0;
    this._stillTime = 0;
    this.root.visible = false;
  }

  dispose() {
    this.disposeBodies();
    this.scene.remove(this.root);
    for (const item of this._owned) item.dispose?.();
    this._owned.length = 0;
  }
}
