import * as THREE from 'three';
import { castHitscan } from './hitscan.js';

const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _lightPos = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);

/**
 * Hitscan fire control: cooldown, raycast, damage, tracers, and impact flashes.
 * Impact lights sit off the hit surface so both the hit face and neighbors light up.
 */
export class CombatSystem {
  constructor({ camera, weaponDef, worldMeshes, characterManager, weaponView, scene, isPlayerAlive }) {
    this.camera = camera;
    this.weaponDef = weaponDef;
    this.worldMeshes = worldMeshes;
    this.characterManager = characterManager;
    this.weaponView = weaponView;
    this.scene = scene;
    this.isPlayerAlive = isPlayerAlive ?? (() => true);

    this.cooldown = 0;
    this.impacts = [];
    this.tracers = [];
    this.lastResult = null;
    this.onHitCharacter = null;

    this._tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this._tracerGeo.rotateX(Math.PI / 2);
  }

  setWorldMeshes(meshes) {
    this.worldMeshes = meshes;
  }

  update(dt, wantsFire) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.updateImpacts(dt);
    this.updateTracers(dt);

    if (wantsFire && this.cooldown <= 0 && this.isPlayerAlive()) {
      this.fire();
    }
  }

  fire() {
    this.cooldown = this.weaponDef.fireInterval;
    this.weaponView?.playFire();

    const characterMeshes = this.characterManager?.getHitMeshes?.() ?? [];
    const result = castHitscan(
      this.camera,
      this.worldMeshes,
      characterMeshes,
      this.weaponDef.range,
    );
    this.lastResult = result;

    this.camera.getWorldDirection(_forward);

    if (this.weaponView?.getMuzzleWorldPosition) {
      this.weaponView.getMuzzleWorldPosition(_muzzle);
    } else {
      _muzzle.copy(this.camera.position).addScaledVector(_forward, 0.45);
    }

    if (result.point) {
      _end.copy(result.point);
    } else {
      _end.copy(_muzzle).addScaledVector(_forward, this.weaponDef.range);
    }

    const tracerColor = result.kind === 'character' ? 0xff7744 : 0xffc070;
    this.spawnTracer(_muzzle, _end, tracerColor, result.normal);

    if (result.kind === 'character') {
      const strength = this.weaponDef.ragdollImpulse ?? 22;
      const impulse = {
        x: _forward.x * strength,
        y: _forward.y * strength * 0.45 + 8,
        z: _forward.z * strength,
      };
      const applied = this.characterManager.applyDamage(
        result.characterId,
        this.weaponDef.damage,
        { impulse, point: result.point, direction: _forward.clone() },
      );
      this.spawnImpact(result.point, 0xff6644, result.normal);
      this.onHitCharacter?.({
        characterId: result.characterId,
        damage: this.weaponDef.damage,
        remaining: applied?.health,
        dead: applied?.dead,
      });
    } else if (result.kind === 'world') {
      this.spawnImpact(result.point, 0xffaa66, result.normal);
    }
  }

  /** Pull a light into open space so it can illuminate the hit face + neighbors. */
  _impactLightPosition(point, normal, alongShot, out) {
    out.copy(point);
    // Prefer surface normal; fall back to reverse shot direction.
    if (normal) {
      _normal.copy(normal);
      if (_normal.dot(alongShot) > 0) _normal.negate();
      out.addScaledVector(_normal, 0.35);
    } else {
      out.addScaledVector(alongShot, -0.35);
    }
    // Nudge up a touch so floor hits also wash nearby walls.
    out.y += 0.12;
    return out;
  }

  /**
   * Bright bolt + traveling/wall lights from muzzle to impact.
   */
  spawnTracer(start, end, color = 0xffc070, normal = null) {
    if (!this.scene) return;

    _dir.subVectors(end, start);
    const length = Math.max(0.05, _dir.length());
    _dir.multiplyScalar(1 / length);

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(this._tracerGeo, mat);
    beam.position.copy(start).addScaledVector(_dir, length * 0.5);
    beam.scale.set(0.012, 0.012, length);
    beam.quaternion.setFromUnitVectors(_zAxis, _dir);
    this.scene.add(beam);

    const muzzleLight = new THREE.PointLight(color, 16, 5, 1.5);
    muzzleLight.position.copy(start);
    this.scene.add(muzzleLight);

    const midLight = new THREE.PointLight(color, 9, 6, 1.35);
    midLight.position.copy(start).addScaledVector(_dir, Math.min(length * 0.45, 6));
    this.scene.add(midLight);

    // Tip sits off the hit surface so floor+walls both catch light.
    const tipLight = new THREE.PointLight(color, 18, 5.5, 1.25);
    this._impactLightPosition(end, normal, _dir, _lightPos);
    tipLight.position.copy(_lightPos);
    this.scene.add(tipLight);

    // Broad room wash near impact — larger radius so adjacent faces catch light too.
    const wash = new THREE.PointLight(color, 11, 7, 1.15);
    wash.position.copy(_lightPos);
    wash.position.y += 0.25;
    this.scene.add(wash);

    const washLights = [wash];
    const samples = length > 8 ? 2 : length > 3 ? 1 : 0;
    for (let i = 0; i < samples; i += 1) {
      const t = 0.2 + (i + 1) * (0.45 / (samples + 1));
      const light = new THREE.PointLight(color, 6, 4.5, 1.4);
      light.position.copy(start).addScaledVector(_dir, length * t);
      light.position.y += 0.15;
      this.scene.add(light);
      washLights.push(light);
    }

    this.tracers.push({
      beam,
      mat,
      muzzleLight,
      midLight,
      tipLight,
      washLights,
      life: 0.11,
      maxLife: 0.11,
      length,
    });
  }

  spawnImpact(point, color, normal = null) {
    if (!point || !this.scene) return;

    this.camera.getWorldDirection(_forward);
    this._impactLightPosition(point, normal, _forward, _lightPos);

    // Primary flash — lights the hit surface from in front.
    const light = new THREE.PointLight(color, 20, 4.5, 1.2);
    light.position.copy(_lightPos);
    this.scene.add(light);

    // Secondary wash — higher + wider so adjacent floor/wall both respond.
    const wash = new THREE.PointLight(color, 12, 6.5, 1.1);
    wash.position.copy(_lightPos);
    wash.position.y += 0.35;
    this.scene.add(wash);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    flash.position.copy(point);
    if (normal) flash.position.addScaledVector(normal, 0.04);
    this.scene.add(flash);

    this.impacts.push({
      light,
      wash,
      flash,
      life: 0.16,
      maxLife: 0.16,
    });
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const t = this.tracers[i];
      t.life -= dt;
      const u = Math.max(0, t.life / t.maxLife);
      const fade = u * u;

      t.mat.opacity = 0.15 + fade * 0.85;
      t.beam.scale.x = 0.008 + fade * 0.01;
      t.beam.scale.y = t.beam.scale.x;

      t.muzzleLight.intensity = 16 * fade;
      t.midLight.intensity = 9 * fade;
      t.tipLight.intensity = 18 * fade;
      for (let w = 0; w < t.washLights.length; w += 1) {
        t.washLights[w].intensity = (w === 0 ? 11 : 6) * fade;
      }

      if (t.life <= 0) {
        this.scene.remove(t.beam);
        this.scene.remove(t.muzzleLight);
        this.scene.remove(t.midLight);
        this.scene.remove(t.tipLight);
        for (const light of t.washLights) this.scene.remove(light);
        t.mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  updateImpacts(dt) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i];
      impact.life -= dt;
      const u = Math.max(0, impact.life / (impact.maxLife || 0.16));
      impact.light.intensity = 20 * u * u;
      if (impact.wash) impact.wash.intensity = 12 * u * u;
      if (impact.flash?.material) impact.flash.material.opacity = 0.95 * u;

      if (impact.life <= 0) {
        this.scene.remove(impact.light);
        if (impact.wash) this.scene.remove(impact.wash);
        this.scene.remove(impact.flash);
        impact.flash.geometry.dispose();
        impact.flash.material.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const impact of this.impacts) {
      this.scene.remove(impact.light);
      if (impact.wash) this.scene.remove(impact.wash);
      this.scene.remove(impact.flash);
      impact.flash.geometry.dispose();
      impact.flash.material.dispose();
    }
    this.impacts = [];

    for (const t of this.tracers) {
      this.scene.remove(t.beam);
      this.scene.remove(t.muzzleLight);
      this.scene.remove(t.midLight);
      this.scene.remove(t.tipLight);
      for (const light of t.washLights) this.scene.remove(light);
      t.mat.dispose();
    }
    this.tracers = [];
    this._tracerGeo?.dispose?.();
  }
}
