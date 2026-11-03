import * as THREE from 'three';
import { SpriteAnimator } from './SpriteAnimator.js';
import { CultistModel } from './CultistModel.js';
import { ModelAnimator, buildModelClips } from './ModelAnimator.js';
import { EnemyBrain } from './EnemyBrain.js';
import { CultistRagdoll } from '../physics/CultistRagdoll.js';

/**
 * Character instance — procedural 3D model or legacy billboard sprite.
 * 3D cultists use Rapier ragdoll + impulse on death.
 */
export class CharacterInstance {
  constructor(
    instanceDef,
    characterDef,
    { frameTextures, clips, anchor, audioBus, physics, scene } = {},
  ) {
    this.id = instanceDef.id;
    this.instanceDef = instanceDef;
    this.def = characterDef;
    this.health = characterDef.maxHealth;
    this.dead = false;
    this.spawnPosition = instanceDef.position.slice();
    this.facingYaw = instanceDef.yaw ?? 0;
    this.frameTextures = frameTextures ?? {};
    this.clips = clips ?? {};
    this.audioBus = audioBus ?? null;
    this.physics = physics ?? null;
    this.scene = scene ?? null;
    this.anchor = anchor ?? characterDef.anchor ?? [0.5, 0];
    this.isModel3d = characterDef.view?.mode === 'model3d';
    this.ragdoll = null;
    this.ragdollActive = false;
    this._pendingImpulse = null;
    this._respawnTimer = null;
    this.respawnDelay = characterDef.respawnDelay ?? 0;

    this.root = new THREE.Group();
    this.root.name = instanceDef.id;
    this.root.position.fromArray(instanceDef.position);

    const height = characterDef.height ?? 1.8;
    this._owned = [];
    this.sprite = null;
    this.model = null;
    this.animator = null;

    if (this.isModel3d) {
      this._buildModel(height);
    } else {
      this._buildSprite(height);
    }

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
    this._owned.push(hitGeo, hitMat);

    this.brain = null;
    if (characterDef.moveSpeed != null || characterDef.detectRange != null) {
      this.brain = new EnemyBrain(this, characterDef);
    }
  }

  _buildModel(height) {
    this.model = new CultistModel(height);
    this.model.root.userData.cultistModel = this.model;
    this.root.add(this.model.root);
    this.root.rotation.y = this.facingYaw;

    const modelClips =
      this.clips && Object.keys(this.clips).length
        ? this.clips
        : buildModelClips(this.def.animations ?? {});
    this.clips = modelClips;
    this.animator = new ModelAnimator(this.model, modelClips, {
      facingYaw: this.facingYaw,
    });
    this.animator.play('idle', { force: true });
    this.animator.onComplete((name) => this._onAnimComplete(name));
    this.animator.setEventHandler((evt) => this._onAnimEvent(evt));
  }

  _buildSprite(height) {
    const firstTex =
      this.frameTextures.idle_front_0 ||
      this.frameTextures.idle_0 ||
      this.frameTextures[Object.keys(this.frameTextures)[0]];
    const frameW = firstTex?.userData?.frameWidth ?? firstTex?.image?.width ?? 128;
    const frameH = firstTex?.userData?.frameHeight ?? firstTex?.image?.height ?? 192;
    const aspect = frameW / Math.max(frameH, 1);
    const width = height * aspect;

    let [ax, ay] = this.anchor;
    if (ay >= 0.99) ay = 0;
    const spriteY = height * ay;

    this.material = new THREE.SpriteMaterial({
      map: firstTex,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      alphaTest: 0.1,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(width, height, 1);
    this.sprite.center.set(ax, ay);
    this.sprite.position.y = spriteY;
    this.root.add(this.sprite);

    this.blendMs = this.def.blendMs ?? 0;
    this.blendSprite = null;
    this.blendMaterial = null;
    if (this.blendMs > 0) {
      this.blendMaterial = this.material.clone();
      this.blendMaterial.transparent = true;
      this.blendMaterial.opacity = 0;
      this.material.transparent = true;
      this.blendSprite = new THREE.Sprite(this.blendMaterial);
      this.blendSprite.scale.copy(this.sprite.scale);
      this.blendSprite.center.set(ax, ay);
      this.blendSprite.position.copy(this.sprite.position);
      this.blendSprite.visible = false;
      this.root.add(this.blendSprite);
    }

    this.baseSpriteScale = { x: width, y: height };
    this.spriteY = spriteY;
    this._owned.push(this.material);
    if (this.blendMaterial) this._owned.push(this.blendMaterial);

    if (this.clips && Object.keys(this.clips).length) {
      this.animator = new SpriteAnimator(
        this.material,
        this.frameTextures,
        this.clips,
        this.sprite,
        {
          facingMode: this.def.facingMode ?? 'mirror5',
          facingYaw: this.facingYaw,
          blendMs: this.blendMs,
          blendSprite: this.blendSprite,
          blendMaterial: this.blendMaterial,
        },
      );
      this.animator.play('idle', { force: true });
      this.animator.onComplete((name) => this._onAnimComplete(name));
      this.animator.setEventHandler((evt) => this._onAnimEvent(evt));
    }
  }

  _onAnimComplete(name) {
    if (name === 'death') {
      this.animator?.play('dead', { force: true });
      return;
    }
    this.brain?.onAnimComplete?.(name);
  }

  _onAnimEvent(evt) {
    this.brain?.onAnimEvent?.(evt);
    if (evt?.name) this.audioBus?.play?.(evt.name);
  }

  applyDamage(amount, hitInfo = null) {
    if (this.dead) {
      return { health: 0, dead: true };
    }
    if (hitInfo?.impulse) this._pendingImpulse = hitInfo;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die(hitInfo);
      return { health: 0, dead: true };
    }
    this.brain?.onDamaged();
    if (!this.brain) {
      this.animator?.play('hit', { force: true });
    }
    return { health: this.health, dead: false };
  }

  die(hitInfo = null) {
    this.dead = true;
    this.health = 0;
    this.hitProxy.visible = false;
    if (this.respawnDelay > 0) this._respawnTimer = this.respawnDelay;
    if (this.sprite && this.baseSpriteScale) {
      this.sprite.scale.set(this.baseSpriteScale.x * 1.15, this.baseSpriteScale.y * 0.55, 1);
      this.sprite.position.y = this.spriteY;
      if (this.animator) this.animator.baseScaleX = Math.abs(this.sprite.scale.x);
    }

    const info = hitInfo ?? this._pendingImpulse;
    this._pendingImpulse = null;

    if (this.isModel3d && this.physics && this.scene) {
      this._activateRagdoll(info);
      this.brain?.onDeath();
      return;
    }

    this.brain?.onDeath();
    if (!this.brain) {
      this.animator?.play('death', { force: true });
    }
  }

  _activateRagdoll(hitInfo) {
    if (!this.model || !this.physics || !this.scene) return;

    // Freeze animated mesh, spawn physics body.
    this.model.root.visible = false;
    this.ragdollActive = true;

    if (!this.ragdoll) {
      this.ragdoll = new CultistRagdoll(this.physics, this.scene, {
        height: this.def.height ?? 2,
        materials: {
          robe: this.model.robe,
          robeDk: this.model.robeDk,
          skin: this.model.skin,
          hood: this.model.hood,
          boots: this.model.boots,
        },
      });
    }

    const impulse = hitInfo?.impulse ?? { x: 0, y: 4, z: -10 };
    const point = hitInfo?.point
      ? { x: hitInfo.point.x, y: hitInfo.point.y, z: hitInfo.point.z }
      : null;

    this.root.updateWorldMatrix(true, true);
    this.model.root.userData.cultistModel = this.model;
    this.ragdoll.activate(this.model.root, impulse, point);
  }

  reset() {
    if (this.ragdoll) {
      this.ragdoll.disposeBodies();
    }
    this.ragdollActive = false;
    this._respawnTimer = null;
    if (this.model) this.model.root.visible = true;

    this.dead = false;
    this.health = this.def.maxHealth;
    this.root.position.fromArray(this.spawnPosition);
    this.facingYaw = this.instanceDef.yaw ?? 0;
    this.hitProxy.visible = true;
    this._pendingImpulse = null;

    if (this.isModel3d) {
      this.root.rotation.y = this.facingYaw;
      this.model?.applyPose({});
    } else if (this.sprite && this.baseSpriteScale) {
      this.sprite.scale.set(this.baseSpriteScale.x, this.baseSpriteScale.y, 1);
      this.sprite.position.y = this.spriteY;
      if (this.animator) this.animator.baseScaleX = Math.abs(this.baseSpriteScale.x);
    }
    this.brain?.reset();
    this.animator?.play('idle', { force: true });
  }

  update(dt, context) {
    if (this.dead && this._respawnTimer != null) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) {
        this.reset();
        return;
      }
    }

    if (this.ragdollActive) {
      // Physics sync happens in PhysicsWorld.step; skip AI/anim.
      return;
    }

    if (this.brain) {
      this.brain.update(dt, context);
    }

    if (this.isModel3d) {
      this.root.rotation.y = this.facingYaw;
      this.animator?.update(dt, { facingYaw: this.facingYaw });
      return;
    }

    const cam = context.camera?.position ?? context.cameraPosition;
    this.animator?.update(dt, {
      cameraPosition: cam,
      characterPosition: this.root.position,
      facingYaw: this.facingYaw,
    });
  }

  dispose() {
    this.ragdoll?.dispose?.();
    this.ragdoll = null;
    this.model?.dispose?.();
    for (const item of this._owned) {
      item.dispose?.();
    }
  }
}
