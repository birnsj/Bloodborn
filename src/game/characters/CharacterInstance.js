import * as THREE from 'three';

/**
 * Stationary billboard character with an invisible hitscan proxy.
 */
export class CharacterInstance {
  constructor(instanceDef, characterDef, textures) {
    this.id = instanceDef.id;
    this.def = characterDef;
    this.health = characterDef.maxHealth;
    this.dead = false;
    this.hitFlashTimer = 0;

    this.textures = textures;
    this.root = new THREE.Group();
    this.root.name = instanceDef.id;
    this.root.position.fromArray(instanceDef.position);

    const height = characterDef.height;
    const aspect = textures.idle.image
      ? textures.idle.image.width / textures.idle.image.height
      : 0.66;
    const width = height * aspect;

    this.material = new THREE.SpriteMaterial({
      map: textures.idle,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      alphaTest: 0.15,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(width, height, 1);
    this.sprite.position.y = height * 0.5;
    this.sprite.center.set(0.5, 0.5);
    this.root.add(this.sprite);

    const hitH = height * 0.9;
    const hitW = characterDef.hitRadius * 2;
    const hitGeo = new THREE.BoxGeometry(hitW, hitH, hitW);
    // Must stay object.visible=true for Raycaster; hide with colorWrite/opacity.
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
    this.hitProxy = new THREE.Mesh(hitGeo, hitMat);
    this.hitProxy.position.y = hitH * 0.5;
    this.hitProxy.userData.characterId = this.id;
    this.hitProxy.name = `${this.id}_hit`;
    this.root.add(this.hitProxy);

    this._owned = [hitGeo, hitMat, this.material];
  }

  applyDamage(amount) {
    if (this.dead) {
      return { health: 0, dead: true };
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
      return { health: 0, dead: true };
    }
    this.showHit();
    return { health: this.health, dead: false };
  }

  showHit() {
    this.hitFlashTimer = 0.12;
    this.material.map = this.textures.hit;
    this.material.needsUpdate = true;
  }

  die() {
    this.dead = true;
    this.health = 0;
    this.material.map = this.textures.dead;
    this.material.needsUpdate = true;
    this.hitProxy.visible = false;
    // Flatten slightly to read as downed.
    this.sprite.scale.y *= 0.55;
    this.sprite.position.y = this.sprite.scale.y * 0.5;
  }

  update(dt) {
    if (this.dead) return;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.material.map = this.textures.idle;
        this.material.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const item of this._owned) {
      item.dispose?.();
    }
    // Textures are owned by CharacterManager.
  }
}
