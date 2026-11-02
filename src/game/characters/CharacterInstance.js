import * as THREE from 'three';
import { SpriteAnimator } from './SpriteAnimator.js';
import { EnemyBrain } from './EnemyBrain.js';

/**
 * Billboard character with optional AI brain and frame animations.
 */
export class CharacterInstance {
  constructor(instanceDef, characterDef, frameTextures) {
    this.id = instanceDef.id;
    this.instanceDef = instanceDef;
    this.def = characterDef;
    this.health = characterDef.maxHealth;
    this.dead = false;
    this.spawnPosition = instanceDef.position.slice();

    this.root = new THREE.Group();
    this.root.name = instanceDef.id;
    this.root.position.fromArray(instanceDef.position);

    const height = characterDef.height ?? 1.8;
    const firstTex =
      frameTextures.idle_0 ||
      frameTextures[Object.keys(frameTextures)[0]];
    // Prefer atlas frame size; falling back to full image makes spritesheet chars huge.
    const frameW = firstTex?.userData?.frameWidth ?? firstTex?.image?.width ?? 96;
    const frameH = firstTex?.userData?.frameHeight ?? firstTex?.image?.height ?? 144;
    const aspect = frameW / Math.max(frameH, 1);
    const width = height * aspect;

    this.material = new THREE.SpriteMaterial({
      map: firstTex,
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
    const hitW = (characterDef.hitRadius ?? 0.4) * 2;
    const hitGeo = new THREE.BoxGeometry(hitW, hitH, hitW);
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

    this.baseSpriteScale = { x: width, y: height };
    this._owned = [hitGeo, hitMat, this.material];

    this.animator = null;
    if (characterDef.animations) {
      this.animator = new SpriteAnimator(
        this.material,
        frameTextures,
        characterDef.animations,
      );
      this.animator.play('idle', { force: true });
    }

    this.brain = null;
    if (characterDef.moveSpeed != null || characterDef.detectRange != null) {
      this.brain = new EnemyBrain(this, characterDef);
    }
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
    this.brain?.onDamaged();
    if (!this.brain) {
      this.animator?.play('hit', { force: true });
    }
    return { health: this.health, dead: false };
  }

  die() {
    this.dead = true;
    this.health = 0;
    this.hitProxy.visible = false;
    this.sprite.scale.y = this.baseSpriteScale.y * 0.55;
    this.sprite.position.y = this.sprite.scale.y * 0.5;
    this.brain?.onDeath();
    if (!this.brain) {
      this.animator?.play('death', { force: true });
    }
  }

  reset() {
    this.dead = false;
    this.health = this.def.maxHealth;
    this.root.position.fromArray(this.spawnPosition);
    this.hitProxy.visible = true;
    this.sprite.scale.set(this.baseSpriteScale.x, this.baseSpriteScale.y, 1);
    this.sprite.position.y = this.baseSpriteScale.y * 0.5;
    this.brain?.reset();
    this.animator?.play('idle', { force: true });
  }

  update(dt, context) {
    this.animator?.update(dt);
    if (this.brain) {
      this.brain.update(dt, context);
    } else if (!this.dead && this.animator?.finished && this.animator.current === 'hit') {
      this.animator.play('idle');
    }
  }

  dispose() {
    for (const item of this._owned) {
      item.dispose?.();
    }
  }
}
