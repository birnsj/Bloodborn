import { AnimPlayer, resolveFacing } from '../animation/AnimPlayer.js';

/**
 * Billboard SpriteMaterial adapter around AnimPlayer.
 * Optional dual-sprite crossfade when blendMs > 0 (Phase 4B).
 */
export class SpriteAnimator {
  constructor(material, textures, clips, sprite, options = {}) {
    this.material = material;
    this.textures = textures;
    this.sprite = sprite;
    this.baseScaleX = Math.abs(sprite?.scale.x ?? 1);
    this.facingMode = options.facingMode ?? 'mirror5';
    this.facingYaw = options.facingYaw ?? 0;
    /** When non-null, overrides resolveFacing mirror (used for L/R strafe while facing camera). */
    this.forceMirror = null;
    /** When non-null, overrides resolveFacing dir (lock side during strafe walk). */
    this.forceDir = null;
    /** Hold current dir/mirror briefly so near-boundary facing doesn't flicker sprites. */
    this.dirHoldSec = 0.18;
    this._pendingDir = null;
    this._pendingMirror = false;
    this._pendingAge = 0;
    this._stickyDir = null;

    this.blendMs = options.blendMs ?? 0;
    this.blendSprite = options.blendSprite ?? null;
    this.blendMaterial = options.blendMaterial ?? null;
    this.blendT = 1;
    this.blendDuration = Math.max(this.blendMs, 0) / 1000;
    this._lastFrameName = null;
    this._lastMirror = false;

    this.player = new AnimPlayer(clips, {
      resolveFrames: (clip, direction) => {
        if (Array.isArray(clip.frames)) return clip.frames;
        if (clip.frames && typeof clip.frames === 'object') {
          return (
            clip.frames[direction] ??
            clip.frames.front ??
            clip.frames.frontSide ??
            Object.values(clip.frames)[0] ??
            []
          );
        }
        return [];
      },
      applyFrame: (name, { mirror } = {}) => {
        this._applyFrameWithBlend(name, mirror);
      },
      onEvent: (evt) => this._eventHandler?.(evt),
    });
  }

  get current() {
    return this.player.current;
  }

  get finished() {
    return this.player.finished;
  }

  setEventHandler(handler) {
    this._eventHandler = handler;
  }

  onComplete(cb) {
    return this.player.onComplete(cb);
  }

  play(name, opts = {}) {
    return this.player.play(name, opts);
  }

  /** Require a new dir/mirror to persist briefly before swapping frames. */
  _setDirectionStable(dir, mirror, dt) {
    const curDir = this.player.direction;
    const curMirror = this.player.mirror;
    if (dir === curDir && mirror === curMirror) {
      this._pendingDir = null;
      this._pendingAge = 0;
      return;
    }
    if (this._pendingDir === dir && this._pendingMirror === mirror) {
      this._pendingAge += dt;
    } else {
      this._pendingDir = dir;
      this._pendingMirror = mirror;
      this._pendingAge = 0;
    }
    if (this._pendingAge >= this.dirHoldSec) {
      this.player.setDirection(dir, mirror);
      this._stickyDir = dir;
      this._pendingDir = null;
      this._pendingAge = 0;
    }
  }

  _tex(name) {
    return this.textures[name] ?? this.textures.get?.(name);
  }

  _applyFrameWithBlend(name, mirror) {
    const tex = this._tex(name);
    if (!tex) return;

    const mirrorChanged = mirror !== this._lastMirror;
    const frameChanged = name !== this._lastFrameName;
    const shouldBlend =
      this.blendDuration > 0 &&
      this.blendSprite &&
      this.blendMaterial &&
      this._lastFrameName != null &&
      (frameChanged || mirrorChanged);

    if (shouldBlend) {
      // Old frame stays on primary briefly; new goes to blend sprite then swap via opacity.
      this.blendMaterial.map = tex;
      this.blendMaterial.needsUpdate = true;
      this.blendMaterial.opacity = 0;
      this.blendSprite.visible = true;
      this.blendSprite.scale.x = this.baseScaleX * (mirror ? -1 : 1);
      this.blendSprite.scale.y = this.sprite.scale.y;
      this.blendT = 0;
    } else {
      if (this.material.map !== tex) {
        this.material.map = tex;
        this.material.needsUpdate = true;
      }
      if (this.sprite) {
        const sx = this.baseScaleX * (mirror ? -1 : 1);
        if (this.sprite.scale.x !== sx) this.sprite.scale.x = sx;
      }
    }

    this._lastFrameName = name;
    this._lastMirror = mirror;

    if (!shouldBlend && this.sprite) {
      const sx = this.baseScaleX * (mirror ? -1 : 1);
      if (this.sprite.scale.x !== sx) this.sprite.scale.x = sx;
    }
  }

  /**
   * Update facing from character yaw and camera, then tick frames.
   */
  update(dt, { cameraPosition, characterPosition, facingYaw } = {}) {
    if (facingYaw != null) this.facingYaw = facingYaw;

    if (cameraPosition && characterPosition) {
      const clipName = this.player?.current;
      // Corpse must not flip as the camera orbits.
      if (clipName === 'death' || clipName === 'dead') {
        this.player.setDirection('front', false);
        if (this.sprite && this.sprite.scale.x !== this.baseScaleX) {
          this.sprite.scale.x = this.baseScaleX;
        }
        this._lastMirror = false;
      } else {
        const toCamX = cameraPosition.x - characterPosition.x;
        const toCamZ = cameraPosition.z - characterPosition.z;
        const camYaw = Math.atan2(toCamX, toCamZ);
        // 0 = character facing the camera → front sprite
        const relative = camYaw - this.facingYaw;
        const { dir, mirror } = resolveFacing(
          relative,
          this.facingMode,
          this._stickyDir ?? this.player.direction,
        );
        const useDir = this.forceDir != null ? this.forceDir : dir;
        const useMirror = this.forceMirror != null ? !!this.forceMirror : mirror;
        // Strafe locks dir/mirror every frame — skip dwell so L/R flips stay in sync with move.
        if (this.forceDir != null || this.forceMirror != null) {
          this._pendingDir = null;
          this._pendingAge = 0;
          this._stickyDir = useDir;
          this.player.setDirection(useDir, useMirror);
        } else {
          this._setDirectionStable(useDir, useMirror, dt);
        }
      }
    }

    this.player.update(dt);

    if (this.blendDuration > 0 && this.blendT < 1 && this.blendSprite && this.blendMaterial) {
      this.blendT = Math.min(1, this.blendT + dt / this.blendDuration);
      this.blendMaterial.opacity = this.blendT;
      this.material.opacity = 1 - this.blendT;
      if (this.blendT >= 1) {
        // Promote blend map to primary
        if (this.blendMaterial.map) {
          this.material.map = this.blendMaterial.map;
          this.material.needsUpdate = true;
        }
        this.material.opacity = 1;
        this.blendMaterial.opacity = 0;
        this.blendSprite.visible = false;
        if (this.sprite) {
          this.sprite.scale.x = this.baseScaleX * (this._lastMirror ? -1 : 1);
        }
      }
    }
  }
}
