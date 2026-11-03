/**
 * Shared clip playback: priority, interruptibility, completion, events.
 * Renderer-agnostic — callers supply resolveFrames(clip, direction) and applyFrame(name).
 */

export const DIR_ORDER = ['front', 'frontSide', 'side', 'backSide', 'back'];

/** Nominal half-width of each facing band (degrees from camera-relative 0). */
const FACING_BANDS = [
  { dir: 'front', max: 22.5 },
  { dir: 'frontSide', max: 67.5 },
  { dir: 'side', max: 112.5 },
  { dir: 'backSide', max: 157.5 },
  { dir: 'back', max: 180 },
];

/**
 * Map relative yaw (rad, 0 = facing camera) to dir + mirror.
 * Pass `stickyDir` to keep the previous band until the angle clears a hysteresis margin.
 */
export function resolveFacing(relativeYaw, facingMode = 'mirror5', stickyDir = null) {
  let angle = relativeYaw;
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;

  const deg = (Math.abs(angle) * 180) / Math.PI;
  const mirror = angle < 0;
  const hyst = 12;

  let dir = 'front';
  if (stickyDir) {
    const idx = FACING_BANDS.findIndex((b) => b.dir === stickyDir);
    if (idx >= 0) {
      const lo = idx === 0 ? 0 : FACING_BANDS[idx - 1].max;
      const hi = FACING_BANDS[idx].max;
      if (deg >= lo - hyst && deg <= hi + hyst) {
        dir = stickyDir;
      } else {
        for (const band of FACING_BANDS) {
          if (deg <= band.max) {
            dir = band.dir;
            break;
          }
        }
      }
    } else {
      for (const band of FACING_BANDS) {
        if (deg <= band.max) {
          dir = band.dir;
          break;
        }
      }
    }
  } else {
    for (const band of FACING_BANDS) {
      if (deg <= band.max) {
        dir = band.dir;
        break;
      }
    }
  }

  if (facingMode === 'unique8' && mirror && dir !== 'front' && dir !== 'back') {
    return { dir: `${dir}L`, mirror: false };
  }

  return {
    dir,
    mirror: facingMode === 'mirror5' ? mirror && dir !== 'front' && dir !== 'back' : false,
  };
}

export function getClipPriority(clip, name) {
  if (clip?.priority != null) return clip.priority;
  const defaults = {
    death: 100,
    dead: 100,
    hit: 60,
    attack: 40,
    strafeAttack: 42,
    fire: 45,
    reload: 50,
    equip: 50,
    lower: 50,
    alert: 20,
    strafe: 12,
    run: 10,
    walk: 10,
    moveBob: 10,
    idle: 0,
  };
  return defaults[name] ?? 0;
}

export class AnimPlayer {
  constructor(clips, { resolveFrames, applyFrame, onEvent } = {}) {
    this.clips = clips ?? {};
    this.resolveFrames = resolveFrames;
    this.applyFrame = applyFrame;
    this.onEvent = onEvent;

    this.current = null;
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
    this.direction = 'front';
    this.mirror = false;
    this._firedEvents = new Set();
    this._completeCallbacks = [];
  }

  get playing() {
    return this.current;
  }

  onComplete(cb) {
    this._completeCallbacks.push(cb);
    return () => {
      this._completeCallbacks = this._completeCallbacks.filter((c) => c !== cb);
    };
  }

  play(name, { force = false, direction, mirror } = {}) {
    const clip = this.clips[name];
    if (!clip) return false;

    if (direction != null) this.direction = direction;
    if (mirror != null) this.mirror = mirror;

    const incomingPri = getClipPriority(clip, name);
    const currentClip = this.current ? this.clips[this.current] : null;
    const currentPri = currentClip ? getClipPriority(currentClip, this.current) : -1;

    if (!force && this.current === name && !this.finished) {
      // Same clip: only refresh direction/mirror for directional art.
      this._applyCurrentFrame();
      return true;
    }

    if (
      !force &&
      this.current &&
      !this.finished &&
      currentClip?.interruptible === false &&
      incomingPri <= currentPri
    ) {
      return false;
    }

    if (!force && this.current && !this.finished && incomingPri < currentPri) {
      return false;
    }

    this.current = name;
    this.frameIndex = 0;
    this.timer = 0;
    this.finished = false;
    this._firedEvents = new Set();
    this._applyCurrentFrame();
    this._emitEventsForFrame(0);
    return true;
  }

  setDirection(direction, mirror = false) {
    if (direction === this.direction && mirror === this.mirror) return;
    this.direction = direction;
    this.mirror = mirror;
    if (this.current) this._applyCurrentFrame();
  }

  update(dt) {
    if (!this.current || this.finished) return;
    const clip = this.clips[this.current];
    if (!clip) return;

    const frames = this._framesFor(clip);
    if (!frames.length) return;

    const fps = Math.max(clip.fps ?? 8, 0.01);
    const frameDur = 1 / fps;
    this.timer += dt;

    while (this.timer >= frameDur) {
      this.timer -= frameDur;
      this.frameIndex += 1;
      if (this.frameIndex >= frames.length) {
        if (clip.loop === false) {
          this.frameIndex = frames.length - 1;
          this.finished = true;
          this._applyCurrentFrame();
          this._emitComplete();
          return;
        }
        this.frameIndex = 0;
        this._firedEvents = new Set();
      }
      this._applyCurrentFrame();
      this._emitEventsForFrame(this.frameIndex);
    }
  }

  _framesFor(clip) {
    if (this.resolveFrames) {
      return this.resolveFrames(clip, this.direction) ?? [];
    }
    if (Array.isArray(clip.frames)) return clip.frames;
    if (clip.frames && typeof clip.frames === 'object') {
      return clip.frames[this.direction] ?? clip.frames.front ?? [];
    }
    return [];
  }

  _applyCurrentFrame() {
    const clip = this.clips[this.current];
    if (!clip) return;
    const frames = this._framesFor(clip);
    const name = frames[this.frameIndex];
    if (name != null) {
      this.applyFrame?.(name, { mirror: this.mirror, clip: this.current });
    }
  }

  _emitEventsForFrame(frameIndex) {
    const clip = this.clips[this.current];
    if (!clip?.events) return;
    for (const evt of clip.events) {
      const key = `${evt.frame}:${evt.name}`;
      if (evt.frame === frameIndex && !this._firedEvents.has(key)) {
        this._firedEvents.add(key);
        this.onEvent?.({ name: evt.name, frame: frameIndex, clip: this.current });
      }
    }
  }

  _emitComplete() {
    const name = this.current;
    const cbs = [...this._completeCallbacks];
    for (const cb of cbs) cb(name);
  }
}
