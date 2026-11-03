/**
 * Numpad live-tune for the FP viewmodel hold pose.
 *
 *   4 / 6     move X (left / right)
 *   8 / 2     move Y (up / down)
 *   9 / 3     move Z (forward / back)
 *   7 / 1     pitch up / down
 *   / / *     yaw left / right
 *   - / +     roll
 *   5         reset to last saved / default
 *   Enter     save pose → public/data/weapons.json
 *
 * Hold Shift for finer steps.
 */
export class WeaponPoseTune {
  constructor(weaponView, { onStatus, weaponId } = {}) {
    this.weaponView = weaponView;
    this.onStatus = onStatus;
    this.weaponId = weaponId ?? weaponView?.def?.id ?? 'pistol_placeholder';
    this._onKeyDown = this.onKeyDown.bind(this);
    this._defaults = weaponView.getPose();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  onKeyDown(event) {
    const code = event.code;
    if (!code.startsWith('Numpad')) return;

    const fine = event.shiftKey;
    const posStep = fine ? 0.005 : 0.02;
    const rotStep = fine ? 0.01 : 0.04;
    let handled = true;

    switch (code) {
      case 'Numpad4':
        this.weaponView.nudgePos(-posStep, 0, 0);
        break;
      case 'Numpad6':
        this.weaponView.nudgePos(posStep, 0, 0);
        break;
      case 'Numpad8':
        this.weaponView.nudgePos(0, posStep, 0);
        break;
      case 'Numpad2':
        this.weaponView.nudgePos(0, -posStep, 0);
        break;
      case 'Numpad9':
        this.weaponView.nudgePos(0, 0, -posStep); // closer to camera (-Z)
        break;
      case 'Numpad3':
        this.weaponView.nudgePos(0, 0, posStep); // farther (+Z / less forward)
        break;
      case 'Numpad7':
        this.weaponView.nudgeRot(rotStep, 0, 0); // pitch
        break;
      case 'Numpad1':
        this.weaponView.nudgeRot(-rotStep, 0, 0);
        break;
      case 'NumpadDivide':
        this.weaponView.nudgeRot(0, rotStep, 0); // yaw
        break;
      case 'NumpadMultiply':
        this.weaponView.nudgeRot(0, -rotStep, 0);
        break;
      case 'NumpadSubtract':
        this.weaponView.nudgeRot(0, 0, -rotStep); // roll
        break;
      case 'NumpadAdd':
        this.weaponView.nudgeRot(0, 0, rotStep);
        break;
      case 'Numpad5':
        this.weaponView.setPose(this._defaults);
        this.report('pose reset');
        break;
      case 'NumpadEnter':
        event.preventDefault();
        this.save();
        return;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      this.reportPose();
    }
  }

  reportPose() {
    const p = this.weaponView.getPose();
    const pos = p.position.map((v) => v.toFixed(3)).join(', ');
    const rot = p.rotation.map((v) => v.toFixed(3)).join(', ');
    this.report(`gun pos [${pos}]  rot [${rot}]`);
  }

  report(message) {
    this.onStatus?.({ type: 'preview', message });
  }

  async save() {
    const pose = this.weaponView.getPose();
    try {
      const res = await fetch('/api/weapon-pose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponId: this.weaponId, pose }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      this._defaults = pose;
      this.report(
        `saved pose → weapons.json  pos[${pose.position.map((v) => v.toFixed(3)).join(',')}]`,
      );
    } catch (err) {
      this.report(`save failed: ${err.message ?? err}`);
    }
  }
}
