import * as THREE from 'three';

/**
 * Procedural box/capsule cultist (Y-up, faces +Z).
 * Pose fields match the capsule sprite baker: thigh/knee/arm/elbow/lean/sideStep/pitch/prop.
 */
export class CultistModel {
  constructor(height = 2.0) {
    this.height = height;
    this.root = new THREE.Group();
    this.root.name = 'cultist_model';
    this._owned = [];

    this.robe = this.mat(0x2a1c28, { metalness: 0.08, roughness: 0.82 });
    this.robeDk = this.mat(0x1a1018, { metalness: 0.06, roughness: 0.88 });
    this.hood = this.mat(0x241820, { metalness: 0.05, roughness: 0.9 });
    this.skin = this.mat(0xc4a078, { metalness: 0.02, roughness: 0.7 });
    this.boots = this.mat(0x1a1218, { metalness: 0.15, roughness: 0.7 });
    this.gold = this.mat(0xd4b060, { metalness: 0.55, roughness: 0.35 });
    this.metal = this.mat(0x6a6a72, { metalness: 0.55, roughness: 0.4 });
    this.eyes = this.mat(0x1a0808, { metalness: 0.1, roughness: 0.5 });

    // Authoring units ≈ baker silhouette (~1.75m); scale to requested height.
    this._unit = height / 1.75;

    this.pitchPivot = new THREE.Group();
    this.root.add(this.pitchPivot);

    this.body = new THREE.Group();
    this.pitchPivot.add(this.body);

    this.hips = new THREE.Group();
    this.hips.position.set(0, 0.92 * this._unit, 0);
    this.body.add(this.hips);

    this.pelvis = this.addBox(
      this.hips,
      [0, -0.06 * this._unit, 0],
      [0.34 * this._unit, 0.22 * this._unit, 0.2 * this._unit],
      this.robe,
    );

    this.legs = [
      this._makeLeg(1),
      this._makeLeg(-1),
    ];

    this.torso = new THREE.Group();
    this.torso.position.set(0, 0.12 * this._unit, 0);
    this.hips.add(this.torso);

    this.chest = this.addBox(
      this.torso,
      [0, 0.28 * this._unit, 0],
      [0.36 * this._unit, 0.48 * this._unit, 0.22 * this._unit],
      this.robe,
    );
    this.addBox(
      this.torso,
      [0.12 * this._unit, 0.22 * this._unit, 0.12 * this._unit],
      [0.04 * this._unit, 0.08 * this._unit, 0.03 * this._unit],
      this.gold,
    );
    this.addCyl(
      this.torso,
      [0, 0.48 * this._unit, 0],
      0.14 * this._unit,
      0.32 * this._unit,
      this.robe,
      'x',
    );

    this.arms = [
      this._makeArm(1),
      this._makeArm(-1),
    ];

    this.headRoot = new THREE.Group();
    this.headRoot.position.set(0, 0.55 * this._unit, 0.02 * this._unit);
    this.torso.add(this.headRoot);

    this.addCyl(this.headRoot, [0, 0.06 * this._unit, 0], 0.07 * this._unit, 0.1 * this._unit, this.skin, 'y');
    this.addBox(
      this.headRoot,
      [0, 0.18 * this._unit, 0],
      [0.22 * this._unit, 0.24 * this._unit, 0.22 * this._unit],
      this.skin,
    );
    // Hood mass behind / above
    this.addBox(
      this.headRoot,
      [0, 0.22 * this._unit, -0.04 * this._unit],
      [0.26 * this._unit, 0.28 * this._unit, 0.26 * this._unit],
      this.hood,
    );
    this.addBox(
      this.headRoot,
      [0, 0.08 * this._unit, -0.1 * this._unit],
      [0.24 * this._unit, 0.16 * this._unit, 0.12 * this._unit],
      this.hood,
    );
    // Face accents
    this.addBox(
      this.headRoot,
      [0, 0.2 * this._unit, 0.12 * this._unit],
      [0.04 * this._unit, 0.05 * this._unit, 0.05 * this._unit],
      this.skin,
    );
    this.addBox(this.headRoot, [0.05 * this._unit, 0.2 * this._unit, 0.11 * this._unit], [0.035 * this._unit, 0.03 * this._unit, 0.02 * this._unit], this.eyes);
    this.addBox(this.headRoot, [-0.05 * this._unit, 0.2 * this._unit, 0.11 * this._unit], [0.035 * this._unit, 0.03 * this._unit, 0.02 * this._unit], this.eyes);

    this.applyPose({});
  }

  _makeLeg(side) {
    const u = this._unit;
    const thighLen = 0.42 * u;
    const shinLen = 0.42 * u;
    const hipY = side * 0.1 * u;

    const thigh = new THREE.Group();
    thigh.position.set(hipY, -0.02 * u, 0);
    this.hips.add(thigh);

    this.addCyl(thigh, [0, -thighLen * 0.5, 0], 0.075 * u, thighLen, this.robeDk, 'y');

    const shin = new THREE.Group();
    shin.position.set(0, -thighLen, 0);
    thigh.add(shin);
    this.addCyl(shin, [0, -shinLen * 0.5, 0], 0.065 * u, shinLen, this.robe, 'y');

    const foot = new THREE.Group();
    foot.position.set(0, -shinLen, 0);
    shin.add(foot);
    this.addBox(foot, [0, -0.03 * u, 0.06 * u], [0.1 * u, 0.06 * u, 0.18 * u], this.boots);

    return { thigh, shin, foot, thighLen, shinLen, side };
  }

  _makeArm(side) {
    const u = this._unit;
    const upperLen = 0.32 * u;
    const foreLen = 0.3 * u;
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.22 * u, 0.42 * u, 0);
    this.torso.add(shoulder);

    const upper = new THREE.Group();
    shoulder.add(upper);
    this.addCyl(upper, [0, -upperLen * 0.5, 0], 0.055 * u, upperLen, this.robeDk, 'y');

    const forearm = new THREE.Group();
    forearm.position.set(0, -upperLen, 0);
    upper.add(forearm);
    this.addCyl(forearm, [0, -foreLen * 0.5, 0], 0.048 * u, foreLen, this.robe, 'y');

    const hand = new THREE.Group();
    hand.position.set(0, -foreLen, 0);
    forearm.add(hand);
    this.addBox(hand, [0, -0.04 * u, 0], [0.07 * u, 0.08 * u, 0.07 * u], this.skin);

    let rifle = null;
    if (side < 0) {
      // Weapon hand (index 1 in baker = -Y / our -X side → side=-1)
      rifle = new THREE.Group();
      hand.add(rifle);
      this.addCyl(rifle, [0, -0.02 * u, 0.16 * u], 0.025 * u, 0.36 * u, this.metal, 'z');
      this.addBox(rifle, [0, -0.04 * u, 0.02 * u], [0.04 * u, 0.08 * u, 0.1 * u], this.robeDk);
      rifle.visible = false;
    }

    return { shoulder, upper, forearm, hand, rifle, upperLen, foreLen, side };
  }

  mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness: opts.metalness ?? 0.2,
      roughness: opts.roughness ?? 0.65,
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  addCyl(parent, pos, radius, length, material, axis = 'y') {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
    this._owned.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /**
   * @param {object} pose
   * thigh/knee/arm/elbow: [left(+X), right(-X)] radians
   * lean, sideLean, sideStep, bounce, pitch, breathe, hipYaw, torsoYaw,
   * headYaw, headPitch, aim (0..1 rifle raise), prop
   */
  applyPose(pose = {}) {
    const thigh = pose.thigh ?? [0.04, -0.04];
    const knee = pose.knee ?? [0.08, 0.08];
    const arm = pose.arm ?? [0.1, 0.1];
    const elbow = pose.elbow ?? [0.28, 0.28];
    const lean = pose.lean ?? 0;
    const sideLean = pose.sideLean ?? 0;
    const sideStep = pose.sideStep ?? 0;
    const bounce = pose.bounce ?? 0;
    const pitch = pose.pitch ?? 0;
    const breathe = pose.breathe ?? 0;
    const hipYaw = pose.hipYaw ?? 0;
    const torsoYaw = pose.torsoYaw ?? 0;
    const headYaw = pose.headYaw ?? 0;
    const headPitch = pose.headPitch ?? 0;
    const aim = pose.aim ?? 0;
    const prop = pose.prop !== false;

    const u = this._unit;
    this.body.position.y = bounce * 0.05 * u;
    this.hips.position.x = sideStep * 0.1 * u;
    this.hips.rotation.y = hipYaw;

    // Tip onto side for death. Pivot is at the feet, so θ→90° lays the body on y=0.
    // A small extra drop accounts for crumpled limb thickness once nearly flat.
    const tip = Math.min(Math.abs(pitch), Math.PI * 0.5);
    this.pitchPivot.rotation.set(0, 0, pitch);
    const flat = tip / (Math.PI * 0.5);
    this.pitchPivot.position.y = tip > 0.01 ? -0.08 * u * flat * flat : 0;

    this.torso.rotation.x = lean;
    this.torso.rotation.y = torsoYaw;
    this.torso.rotation.z = sideLean;
    const chestScale = 1 + breathe * 0.035;
    this.chest.scale.set(1 + breathe * 0.01, chestScale, 1 + breathe * 0.02);

    this.headRoot.rotation.y = headYaw;
    this.headRoot.rotation.x = headPitch;

    for (let i = 0; i < 2; i += 1) {
      const leg = this.legs[i];
      // Positive thigh.x swings leg forward (+Z). Knee bends backward (+) from hang.
      leg.thigh.rotation.x = thigh[i];
      leg.thigh.rotation.z = leg.side * 0.04;
      const kneeBend = Math.max(0, knee[i]);
      leg.shin.rotation.x = kneeBend;
      // Plant foot flatter when knee opens; toe down a bit when flexed.
      leg.foot.rotation.x = -Math.min(0.55, kneeBend * 0.35) + Math.max(0, -thigh[i]) * 0.15;
    }

    for (let i = 0; i < 2; i += 1) {
      const a = this.arms[i];
      const isWeapon = !!a.rifle;
      // arm[i]: positive = swing forward (+Z), negative = back.
      a.upper.rotation.x = arm[i];
      a.upper.rotation.z = a.side * (0.14 + (isWeapon ? aim * 0.1 : 0));
      a.upper.rotation.y = isWeapon ? -aim * 0.4 : 0;
      a.forearm.rotation.x = Math.max(0.05, elbow[i]);
      a.hand.rotation.x = isWeapon ? -aim * 0.55 : 0;
      if (a.rifle) {
        a.rifle.visible = prop;
        // Point barrel along +Z as aim increases.
        a.rifle.rotation.x = -Math.PI * 0.5 * aim;
        a.rifle.position.set(0, -0.02 * u * (1 - aim), 0.02 * u + aim * 0.12 * u);
      }
    }
  }

  dispose() {
    this.root.traverse((obj) => {
      obj.geometry?.dispose?.();
    });
    for (const item of this._owned) item.dispose?.();
    this._owned.length = 0;
  }
}
