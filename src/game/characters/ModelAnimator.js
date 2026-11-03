import { getClipPriority } from '../animation/AnimPlayer.js';

const DEG = Math.PI / 180;
const deg = (d) => d * DEG;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpArr(a, b, t) {
  if (!a) return b?.slice?.() ?? a;
  if (!b) return a.slice();
  const n = Math.max(a.length, b.length);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(lerp(a[i] ?? 0, b[i] ?? 0, t));
  return out;
}

function smooth(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function easeOut(t) {
  const x = 1 - Math.min(1, Math.max(0, t));
  return 1 - x * x;
}

function keySample(keys, u) {
  if (!keys?.length) return {};
  if (keys.length === 1) return { ...keys[0] };
  const x = Math.min(1, Math.max(0, u)) * (keys.length - 1);
  const i = Math.min(keys.length - 2, Math.floor(x));
  const f = smooth(x - i);
  const a = keys[i];
  const b = keys[i + 1];
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[k];
    const bv = b[k];
    if (Array.isArray(av) || Array.isArray(bv)) out[k] = lerpArr(av ?? bv, bv ?? av, f);
    else if (typeof (av ?? bv) === 'number') out[k] = lerp(av ?? bv ?? 0, bv ?? av ?? 0, f);
    else if (typeof (av ?? bv) === 'boolean') out[k] = f < 0.5 ? !!av : !!bv;
    else out[k] = f < 0.5 ? av : bv;
  }
  return out;
}

const POSE_KEYS = [
  'thigh',
  'knee',
  'arm',
  'elbow',
  'lean',
  'sideLean',
  'sideStep',
  'bounce',
  'pitch',
  'breathe',
  'hipYaw',
  'torsoYaw',
  'headYaw',
  'headPitch',
  'aim',
  'prop',
];

export function lerpPose(a = {}, b = {}, t) {
  const out = {};
  for (const k of POSE_KEYS) {
    const av = a[k];
    const bv = b[k];
    if (av == null && bv == null) continue;
    if (Array.isArray(av) || Array.isArray(bv)) out[k] = lerpArr(av, bv, t);
    else if (typeof (av ?? bv) === 'boolean') out[k] = t < 0.5 ? !!av : !!bv;
    else out[k] = lerp(Number(av) || 0, Number(bv) || 0, t);
  }
  return out;
}

/** Continuous pose for clip progress u in [0,1] — tuned for readable live 3D. */
export function evalCultistPose(clip, u) {
  const t = Math.min(1, Math.max(0, u));

  if (clip === 'idle') {
    const w = t * Math.PI * 2;
    const breathe = Math.sin(w);
    const shift = Math.sin(w * 0.5);
    return {
      thigh: [deg(4 + shift * 3), deg(-2 - shift * 3)],
      knee: [deg(8 + Math.max(0, shift) * 6), deg(8 + Math.max(0, -shift) * 6)],
      // Positive = forward; weapon hand rests slightly raised.
      arm: [deg(6 + breathe * 2), deg(18 + breathe * 2)],
      elbow: [deg(22), deg(34)],
      breathe,
      bounce: breathe * 0.35,
      hipYaw: shift * deg(3),
      torsoYaw: -shift * deg(2),
      headYaw: Math.sin(w * 0.35) * deg(6),
      headPitch: breathe * deg(2),
      sideStep: shift * 0.25,
      prop: true,
      aim: 0.2,
    };
  }

  if (clip === 'walk' || clip === 'run') {
    const run = clip === 'run';
    const phase = t * Math.PI * 2;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const amp = deg(run ? 42 : 28);
    const kneeFlex = deg(run ? 70 : 42);
    const kneeBase = deg(run ? 12 : 8);
    const armAmp = deg(run ? 38 : 26);
    const bob = run ? 1.1 : 0.7;
    return {
      thigh: [amp * s, -amp * s],
      knee: [
        kneeBase + kneeFlex * Math.max(0, -c),
        kneeBase + kneeFlex * Math.max(0, c),
      ],
      // Opposite arm/leg; weapon arm smaller swing + held forward.
      arm: [-armAmp * s * 0.9, deg(run ? 22 : 16) - armAmp * s * 0.35],
      elbow: [
        deg(run ? 50 : 28) + deg(14) * Math.max(0, -s),
        deg(run ? 42 : 32) + deg(10) * Math.max(0, s),
      ],
      lean: deg(run ? 12 : 4) + Math.abs(s) * deg(run ? 3 : 1),
      bounce: Math.abs(c) * bob,
      hipYaw: s * deg(run ? 10 : 7),
      torsoYaw: -s * deg(run ? 8 : 5),
      headYaw: -s * deg(4),
      headPitch: deg(run ? 6 : 2),
      sideStep: 0,
      prop: true,
      aim: run ? 0.4 : 0.28,
    };
  }

  if (clip === 'alert') {
    const e = easeOut(t);
    return {
      thigh: [deg(6), deg(10)],
      knee: [deg(12), deg(8)],
      arm: [deg(12), deg(20 + e * 50)],
      elbow: [deg(24), deg(28 + e * 12)],
      lean: deg(-2 + e * 8),
      bounce: e * 0.4,
      breathe: 0.4,
      hipYaw: deg(-4) * e,
      torsoYaw: deg(6) * e,
      headYaw: deg(-8) * e,
      headPitch: deg(4) * e,
      prop: true,
      aim: 0.25 + e * 0.6,
    };
  }

  if (clip === 'attack') {
    const keys = [
      {
        arm: [deg(14), deg(28)],
        elbow: [deg(28), deg(40)],
        lean: deg(-4),
        aim: 0.5,
        bounce: 0.1,
        headPitch: deg(2),
      },
      {
        arm: [deg(8), deg(70)],
        elbow: [deg(18), deg(18)],
        lean: deg(14),
        aim: 1,
        bounce: 0.35,
        headPitch: deg(8),
        torsoYaw: deg(6),
      },
      {
        arm: [deg(10), deg(55)],
        elbow: [deg(22), deg(28)],
        lean: deg(8),
        aim: 0.9,
        bounce: 0.15,
        headPitch: deg(4),
      },
      {
        arm: [deg(12), deg(32)],
        elbow: [deg(26), deg(34)],
        lean: deg(2),
        aim: 0.55,
        bounce: 0,
        headPitch: deg(2),
      },
    ];
    return {
      thigh: [deg(6), deg(12)],
      knee: [deg(10), deg(8)],
      prop: true,
      breathe: 0,
      ...keySample(keys, t),
    };
  }

  if (clip === 'strafe') {
    const phase = t * Math.PI * 2;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    return {
      thigh: [deg(12) + deg(18) * s, deg(12) - deg(18) * s],
      knee: [
        deg(16) + deg(36) * Math.max(0, s),
        deg(16) + deg(36) * Math.max(0, -s),
      ],
      arm: [deg(14), deg(36)],
      elbow: [deg(26), deg(38)],
      sideStep: s * 1.15,
      sideLean: deg(10) * s,
      bounce: Math.abs(c) * 0.55,
      hipYaw: s * deg(4),
      torsoYaw: -s * deg(3),
      headYaw: -s * deg(5),
      prop: true,
      aim: 0.75,
    };
  }

  if (clip === 'strafeAttack') {
    const phase = t * Math.PI * 2;
    const s = Math.sin(phase);
    const keys = [
      { arm: [deg(12), deg(34)], elbow: [deg(24), deg(42)], lean: deg(-2), aim: 0.6 },
      { arm: [deg(8), deg(72)], elbow: [deg(16), deg(18)], lean: deg(10), aim: 1 },
      { arm: [deg(10), deg(52)], elbow: [deg(20), deg(30)], lean: deg(5), aim: 0.85 },
      { arm: [deg(12), deg(30)], elbow: [deg(24), deg(34)], lean: deg(1), aim: 0.6 },
    ];
    return {
      thigh: [deg(12) + deg(14) * s, deg(12) - deg(14) * s],
      knee: [
        deg(16) + deg(28) * Math.max(0, s),
        deg(16) + deg(28) * Math.max(0, -s),
      ],
      sideStep: s * 0.9,
      sideLean: deg(8) * s,
      bounce: Math.abs(Math.cos(phase)) * 0.4,
      prop: true,
      breathe: 0,
      ...keySample(keys, t),
    };
  }

  if (clip === 'hit') {
    const e = easeOut(t);
    const flinch = Math.sin(t * Math.PI);
    return {
      thigh: [deg(16 + flinch * 8), deg(6)],
      knee: [deg(24 + flinch * 10), deg(10)],
      arm: [deg(20 + flinch * 18), deg(30 + flinch * 12)],
      elbow: [deg(48), deg(44)],
      lean: deg(-6 - e * 8),
      bounce: flinch * 0.8,
      hipYaw: deg(-10) * flinch,
      torsoYaw: deg(8) * flinch,
      headPitch: deg(-12) * flinch,
      headYaw: deg(10) * flinch,
      prop: true,
      aim: 0.25,
    };
  }

  if (clip === 'death') {
    const e = smooth(t);
    // Crumple first half, then tip fully onto the ground (90°).
    const crumple = smooth(Math.min(1, t / 0.45));
    const tip = smooth(Math.max(0, (t - 0.25) / 0.75));
    const pitch = tip * deg(90);
    return {
      thigh: [deg(18 + crumple * 55), deg(14 + crumple * 50)],
      knee: [deg(28 + crumple * 55), deg(26 + crumple * 52)],
      arm: [deg(12 + crumple * 50), deg(18 + crumple * 42)],
      elbow: [deg(44), deg(40)],
      pitch,
      bounce: -crumple * 1.2,
      lean: deg(6) * crumple,
      headPitch: deg(18) * tip,
      headYaw: deg(8) * tip,
      prop: true,
      aim: Math.max(0, 0.35 * (1 - tip)),
      breathe: 0,
    };
  }

  // dead — fully flat on the ground
  return {
    thigh: [deg(72), deg(68)],
    knee: [deg(82), deg(78)],
    arm: [deg(55), deg(48)],
    elbow: [deg(50), deg(46)],
    pitch: deg(90),
    bounce: -1.2,
    lean: deg(6),
    headPitch: deg(18),
    headYaw: deg(8),
    prop: true,
    aim: 0,
    breathe: 0,
  };
}

function clipDuration(clip) {
  const fps = Math.max(clip.fps ?? 8, 0.01);
  const frames = Math.max(1, clip.frameCount ?? clip.frames ?? 8);
  return frames / fps;
}

/**
 * Drop-in for SpriteAnimator: play/update/forceDir/events for a CultistModel.
 */
export class ModelAnimator {
  constructor(model, clips, options = {}) {
    this.model = model;
    this.clips = clips ?? {};
    this.facingYaw = options.facingYaw ?? 0;
    this.forceMirror = null;
    this.forceDir = null;
    this.blendDuration = options.blendDuration ?? 0.14;

    this._eventHandler = null;
    this._completeCallbacks = [];
    this._clip = null;
    this._t = 0;
    this._dur = 1;
    this._finished = false;
    this._firedEvents = new Set();
    this._u = 0;
    this._pose = evalCultistPose('idle', 0);
    this._blendFrom = null;
    this._blendT = 1;

    this.player = {
      get current() {
        return this._owner._clip;
      },
      get finished() {
        return this._owner._finished;
      },
      get clips() {
        return this._owner.clips;
      },
      get direction() {
        return 'front';
      },
      get mirror() {
        return false;
      },
      play: (name, opts) => this._owner.play(name, opts),
      _owner: this,
    };
  }

  get current() {
    return this._clip;
  }

  get finished() {
    return this._finished;
  }

  setEventHandler(handler) {
    this._eventHandler = handler;
  }

  onComplete(cb) {
    this._completeCallbacks.push(cb);
    return () => {
      this._completeCallbacks = this._completeCallbacks.filter((c) => c !== cb);
    };
  }

  play(name, { force = false } = {}) {
    const clip = this.clips[name];
    if (!clip) return false;

    const incomingPri = getClipPriority(clip, name);
    const currentClip = this._clip ? this.clips[this._clip] : null;
    const currentPri = currentClip ? getClipPriority(currentClip, this._clip) : -1;

    if (!force && this._clip === name && !this._finished) return true;

    if (
      !force &&
      this._clip &&
      !this._finished &&
      currentClip?.interruptible === false &&
      incomingPri <= currentPri
    ) {
      return false;
    }

    if (!force && this._clip && !this._finished && incomingPri < currentPri) {
      return false;
    }

    if (this._clip && this._clip !== name) {
      this._blendFrom = { ...this._pose };
      this._blendT = 0;
    }

    this._clip = name;
    this._t = 0;
    this._dur = clipDuration(clip);
    this._finished = false;
    this._firedEvents = new Set();
    this._apply(0, 0);
    this._emitEvents(0);
    return true;
  }

  update(dt, { facingYaw } = {}) {
    if (facingYaw != null) this.facingYaw = facingYaw;
    if (!this._clip) return;

    const clip = this.clips[this._clip];
    if (!clip) return;

    if (this._blendT < 1) {
      this._blendT = Math.min(1, this._blendT + dt / Math.max(0.01, this.blendDuration));
    }

    if (!this._finished) {
      this._t += dt;
      let u = this._dur > 0 ? this._t / this._dur : 1;
      if (u >= 1) {
        if (clip.loop === false) {
          u = 1;
          if (!this._finished) {
            this._finished = true;
            this._apply(u, dt);
            this._emitEvents(u);
            for (const cb of [...this._completeCallbacks]) cb(this._clip);
          } else {
            this._apply(u, dt);
          }
        } else {
          this._t %= this._dur;
          u = this._dur > 0 ? this._t / this._dur : 0;
          this._firedEvents = new Set();
          this._apply(u, dt);
          this._emitEvents(u);
        }
      } else {
        this._apply(u, dt);
        this._emitEvents(u);
      }
    } else {
      this._apply(1, dt);
    }
  }

  _apply(u) {
    this._u = u;
    const name = this._clip === 'dead' ? 'dead' : this._clip;
    let pose = evalCultistPose(name, u);
    if (this._blendFrom && this._blendT < 1) {
      pose = lerpPose(this._blendFrom, pose, smooth(this._blendT));
    } else {
      this._blendFrom = null;
    }
    this._pose = pose;
    this.model?.applyPose(pose);
  }

  _emitEvents(u) {
    const clip = this.clips[this._clip];
    if (!clip?.events?.length) return;
    const frames = Math.max(1, clip.frameCount ?? clip.frames ?? 8);
    for (const evt of clip.events) {
      const at = evt.u != null ? evt.u : (evt.frame ?? 0) / frames;
      const key = `${evt.name}@${at}`;
      if (u + 1e-4 >= at && !this._firedEvents.has(key)) {
        this._firedEvents.add(key);
        this._eventHandler?.({ name: evt.name, frame: evt.frame ?? 0, clip: this._clip, u });
      }
    }
  }
}

/** Build ModelAnimator clips from characters.json animations block. */
export function buildModelClips(animations = {}) {
  const clips = {};
  for (const [name, cfg] of Object.entries(animations)) {
    const frameCount = cfg.frameCount ?? defaultFrameCount(name);
    clips[name] = {
      fps: cfg.fps ?? 8,
      loop: cfg.loop ?? !['death', 'hit', 'attack', 'strafeAttack', 'alert'].includes(name),
      priority: cfg.priority,
      interruptible: cfg.interruptible,
      events: cfg.events ?? [],
      frameCount,
      frames: frameCount,
    };
    if (name === 'dead') clips[name].loop = true;
    if (['death', 'attack', 'strafeAttack', 'alert', 'hit'].includes(name) && clips[name].interruptible == null) {
      clips[name].interruptible = false;
    }
  }
  return clips;
}

function defaultFrameCount(name) {
  const map = {
    idle: 8,
    walk: 8,
    run: 8,
    strafe: 8,
    alert: 4,
    attack: 4,
    strafeAttack: 4,
    hit: 4,
    death: 6,
    dead: 1,
  };
  return map[name] ?? 8;
}
