/**
 * Minimal frame animator for billboard SpriteMaterials.
 * textures: Map or object of frameName -> THREE.Texture
 * animations: { idle: { frames, fps, loop? }, ... }
 */
export class SpriteAnimator {
  constructor(material, textures, animations) {
    this.material = material;
    this.textures = textures;
    this.animations = animations;
    this.current = null;
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
  }

  play(name, { force = false } = {}) {
    if (!force && this.current === name && !this.finished) return;
    const anim = this.animations[name];
    if (!anim?.frames?.length) return;
    this.current = name;
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
    this.applyFrame();
  }

  update(dt) {
    if (!this.current || this.finished) return;
    const anim = this.animations[this.current];
    if (!anim) return;

    const fps = Math.max(anim.fps ?? 8, 0.01);
    const frameDur = 1 / fps;
    this.timer += dt;

    while (this.timer >= frameDur) {
      this.timer -= frameDur;
      this.frameIndex += 1;
      if (this.frameIndex >= anim.frames.length) {
        if (anim.loop === false) {
          this.frameIndex = anim.frames.length - 1;
          this.finished = true;
          this.applyFrame();
          return;
        }
        this.frameIndex = 0;
      }
      this.applyFrame();
    }
  }

  applyFrame() {
    const anim = this.animations[this.current];
    if (!anim) return;
    const name = anim.frames[this.frameIndex];
    const tex = this.textures[name] ?? this.textures.get?.(name);
    if (tex && this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
  }
}
