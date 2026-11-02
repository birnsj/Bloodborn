import * as THREE from 'three';
import { castHitscan } from './hitscan.js';

/**
 * Hitscan fire control: cooldown, raycast, damage, and impact flashes.
 */
export class CombatSystem {
  constructor({ camera, weaponDef, worldMeshes, characterManager, weaponView, scene }) {
    this.camera = camera;
    this.weaponDef = weaponDef;
    this.worldMeshes = worldMeshes;
    this.characterManager = characterManager;
    this.weaponView = weaponView;
    this.scene = scene;

    this.cooldown = 0;
    this.impacts = [];
    this.lastResult = null;
    this.onHitCharacter = null;
  }

  setWorldMeshes(meshes) {
    this.worldMeshes = meshes;
  }

  update(dt, wantsFire) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.updateImpacts(dt);

    if (wantsFire && this.cooldown <= 0) {
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

    if (result.kind === 'character') {
      const applied = this.characterManager.applyDamage(
        result.characterId,
        this.weaponDef.damage,
      );
      this.spawnImpact(result.point, 0xff6644);
      this.onHitCharacter?.({
        characterId: result.characterId,
        damage: this.weaponDef.damage,
        remaining: applied?.health,
        dead: applied?.dead,
      });
    } else if (result.kind === 'world') {
      this.spawnImpact(result.point, 0xffaa66);
    }
  }

  spawnImpact(point, color) {
    if (!point || !this.scene) return;

    const light = new THREE.PointLight(color, 40, 3, 2);
    light.position.copy(point);
    this.scene.add(light);

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    flash.position.copy(point);
    this.scene.add(flash);

    this.impacts.push({ light, flash, life: 0.08 });
  }

  updateImpacts(dt) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i];
      impact.life -= dt;
      if (impact.life <= 0) {
        this.scene.remove(impact.light);
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
      this.scene.remove(impact.flash);
      impact.flash.geometry.dispose();
      impact.flash.material.dispose();
    }
    this.impacts = [];
  }
}
