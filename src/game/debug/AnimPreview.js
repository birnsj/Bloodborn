/**
 * Dev-only animation preview (?preview=1 or ` toggle).
 * Forces cultist clips (1–8) + yaw nudge; weapon clips (Q/E/F/G/V).
 * Does not change combat stats.
 */
const CULTIST_CLIPS = [
  'idle',
  'walk',
  'run',
  'strafe',
  'strafeAttack',
  'attack',
  'alert',
  'hit',
  'death',
  'dead',
];

const WEAPON_KEYS = {
  KeyQ: 'idle',
  KeyE: 'equip',
  KeyF: 'fire',
  KeyG: 'reload',
  KeyV: 'lower',
  KeyT: 'walk',
  KeyC: 'recoil',
};

export function isPreviewEnabled() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === '1') return true;
  return false;
}

export class AnimPreview {
  constructor({ characters, weaponView, onStatus }) {
    this.characters = characters;
    this.weaponView = weaponView;
    this.onStatus = onStatus;
    this.enabled = isPreviewEnabled();
    this.yawNudge = 0;
    this.forcedCultist = null;
    this._onKeyDown = (e) => this.onKeyDown(e);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    if (this.enabled) {
      this.report('preview ON — 1-0 cultist (strafe=4), [ ] yaw, Q/E/F/G/V/T/C weapon, ` toggle');
    }
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  report(msg) {
    this.onStatus?.({ type: 'preview', message: msg });
  }

  onKeyDown(event) {
    if (event.code === 'Backquote') {
      this.enabled = !this.enabled;
      this.forcedCultist = null;
      this.report(this.enabled ? 'preview ON' : 'preview OFF');
      return;
    }

    if (!this.enabled) return;

    // Digit1–0 → cultist clips (0 = 10th)
    if (event.code.startsWith('Digit')) {
      let n = Number(event.code.replace('Digit', ''));
      if (n === 0) n = 10;
      if (n >= 1 && n <= CULTIST_CLIPS.length) {
        const clip = CULTIST_CLIPS[n - 1];
        this.forcedCultist = clip;
        this.applyCultist(clip);
        this.report(`cultist → ${clip}`);
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'BracketLeft') {
      this.yawNudge -= Math.PI / 8;
      this.applyYaw();
      this.report(`yaw ${((this.yawNudge * 180) / Math.PI).toFixed(0)}°`);
      event.preventDefault();
      return;
    }
    if (event.code === 'BracketRight') {
      this.yawNudge += Math.PI / 8;
      this.applyYaw();
      this.report(`yaw ${((this.yawNudge * 180) / Math.PI).toFixed(0)}°`);
      event.preventDefault();
      return;
    }

    const weaponClip = WEAPON_KEYS[event.code];
    if (weaponClip && this.weaponView) {
      if (weaponClip === 'fire') this.weaponView.playFire();
      else if (weaponClip === 'reload') this.weaponView.playReload();
      else if (weaponClip === 'equip') this.weaponView.playEquip();
      else if (weaponClip === 'lower') this.weaponView.playLower();
      else if (weaponClip === 'walk') this.weaponView.player?.play('walk', { force: true });
      else if (weaponClip === 'recoil') this.weaponView.player?.play('recoil', { force: true });
      else this.weaponView.playIdle();
      this.report(`weapon → ${weaponClip}`);
      event.preventDefault();
    }
  }

  eachCharacter(fn) {
    if (!this.characters?.instances) return;
    for (const ch of this.characters.instances.values()) fn(ch);
  }

  applyCultist(clip) {
    this.eachCharacter((ch) => {
      if (ch.dead && clip !== 'death' && clip !== 'dead') return;
      // Pause AI while forcing clips so EnemyBrain does not fight preview.
      if (ch.brain) ch.brain._previewLock = true;
      ch.animator?.play(clip, { force: true });
    });
    this.applyYaw();
  }

  applyYaw() {
    this.eachCharacter((ch) => {
      const base = ch.instanceDef?.yaw ?? 0;
      ch.facingYaw = base + this.yawNudge;
    });
  }

  /** Call each frame while enabled to keep forced clip sticky for loops. */
  update() {
    if (!this.enabled) {
      this.eachCharacter((ch) => {
        if (ch.brain) ch.brain._previewLock = false;
      });
      return;
    }
    if (!this.forcedCultist) return;
    this.eachCharacter((ch) => {
      if (ch.brain) ch.brain._previewLock = true;
      const current = ch.animator?.player?.current;
      const base = this.forcedCultist;
      if (current !== base && !String(current ?? '').startsWith(base)) {
        if (ch.animator?.player?.finished || current === 'idle' || current == null) {
          ch.animator?.play(base, { force: true });
        }
      }
    });
  }
}
