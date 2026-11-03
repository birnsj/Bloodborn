import { useCallback, useEffect, useState } from 'react';

const SLIDERS = [
  { key: 'x', label: 'Position X', min: -0.6, max: 0.6, step: 0.005 },
  { key: 'y', label: 'Position Y', min: -0.6, max: 0.2, step: 0.005 },
  { key: 'distance', label: 'Distance', min: 0.05, max: 1.2, step: 0.005 },
  { key: 'pitch', label: 'Pitch', min: -0.2, max: 1.4, step: 0.01 },
];

/**
 * Dev panel: live-tune FP gun rest pose and save to weapons.json.
 * Click the panel (or Esc) to free the mouse before dragging sliders.
 */
export default function WeaponPosePanel({ weaponView, weaponId }) {
  const [pose, setPose] = useState(null);
  const [saveState, setSaveState] = useState('');

  useEffect(() => {
    if (!weaponView?.getTunePose) {
      setPose(null);
      return undefined;
    }
    setPose(weaponView.getTunePose());
    return undefined;
  }, [weaponView]);

  const unlockPointer = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  const onChange = useCallback(
    (key, value) => {
      if (!weaponView) return;
      weaponView.setPose({ [key]: value });
      setPose(weaponView.getTunePose());
      setSaveState('');
    },
    [weaponView],
  );

  const onSave = useCallback(async () => {
    if (!weaponView || !weaponId) return;
    const posePayload = weaponView.getPose();
    setSaveState('Saving…');
    try {
      const res = await fetch('/api/weapon-pose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponId, pose: posePayload }),
      });
      let data = {};
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text };
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      setSaveState('Saved to weapons.json');
    } catch (err) {
      setSaveState(err.message ?? String(err));
    }
  }, [weaponView, weaponId]);

  if (!weaponView || !pose) return null;

  return (
    <aside className="weapon-pose-panel" onPointerDown={unlockPointer}>
      <div className="weapon-pose-panel__title">Weapon pose</div>
      <div className="weapon-pose-panel__hint">
        Click here / Esc to free mouse · Save writes weapons.json
      </div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="weapon-pose-panel__row">
          <span className="weapon-pose-panel__label">
            {s.label}
            <em>{Number(pose[s.key]).toFixed(3)}</em>
          </span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={pose[s.key]}
            onChange={(e) => onChange(s.key, Number(e.target.value))}
          />
        </label>
      ))}
      <button type="button" className="weapon-pose-panel__save" onClick={onSave}>
        Save default position
      </button>
      {saveState && <div className="weapon-pose-panel__status">{saveState}</div>}
    </aside>
  );
}
