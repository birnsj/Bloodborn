/**
 * Mute-safe audio bus for anim-synced SFX (Phase 4B).
 * Placeholder: WebAudio oscillators / short noise bursts; swap for /audio/*.ogg later.
 */
export class AudioBus {
  constructor() {
    this.enabled = true;
    this.muted = false;
    this.ctx = null;
    this._unlocked = false;
  }

  /** Call after a user gesture (pointer lock) so AudioContext can start. */
  unlock() {
    if (this._unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = this.ctx ?? new Ctx();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._unlocked = true;
    } catch {
      this.enabled = false;
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
  }

  play(name, { volume = 0.2 } = {}) {
    if (!this.enabled || this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (name === 'footstep') {
      this._noiseBurst(now, 0.04, 180, volume * 0.35);
    } else if (name === 'muzzle' || name === 'fire') {
      this._noiseBurst(now, 0.06, 420, volume);
      this._tone(now, 90, 0.05, volume * 0.5);
    } else if (name === 'hit') {
      this._tone(now, 140, 0.08, volume * 0.4);
    }
  }

  _tone(when, freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.01);
  }

  _noiseBurst(when, dur, hpFreq, vol) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(when);
  }

  dispose() {
    this.ctx?.close?.();
    this.ctx = null;
  }
}
