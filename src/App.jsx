import { useCallback, useState } from 'react';
import GameCanvas from './game/GameCanvas.jsx';
import WeaponPosePanel from './game/debug/WeaponPosePanel.jsx';
import './App.css';

const MAP_OPTIONS = {
  test: '/maps/test-level.json',
  mansion: '/maps/mansion-vertical-test.json',
};

function resolveMapUrl() {
  const params = new URLSearchParams(window.location.search);
  const key = (params.get('map') || 'test').toLowerCase();
  return MAP_OPTIONS[key] ?? MAP_OPTIONS.test;
}

export default function App() {
  const [mapUrl] = useState(() => resolveMapUrl());
  const [status, setStatus] = useState('Loading level…');
  const [locked, setLocked] = useState(false);
  const [health, setHealth] = useState(null);
  const [maxHealth, setMaxHealth] = useState(100);
  const [hurtFlash, setHurtFlash] = useState(false);
  const [dead, setDead] = useState(false);
  const [weaponView, setWeaponView] = useState(null);
  const [weaponId, setWeaponId] = useState(null);

  const handleWeaponReady = useCallback(({ weaponView: view, weaponId: id }) => {
    setWeaponView(view);
    setWeaponId(id);
  }, []);

  const handleLockChange = useCallback((isLocked) => {
    setLocked(isLocked);
    if (dead) return;
    setStatus(
      isLocked
        ? 'WASD move · Mouse look · LMB fire · Esc release'
        : 'Click the viewport to capture the mouse.',
    );
  }, [dead]);

  const handleReady = useCallback(() => {
    setStatus('Level loaded. Click the viewport to begin.');
  }, []);

  const handleError = useCallback((message) => {
    setStatus(`Error: ${message}`);
  }, []);

  const handleCombatEvent = useCallback((evt) => {
    if (!evt || dead) return;
    if (evt.dead) {
      setStatus(`Enemy down (${evt.characterId})`);
    } else {
      setStatus(`Hit ${evt.characterId} for ${evt.damage} · HP ${evt.remaining}`);
    }
  }, [dead]);

  const handleHudEvent = useCallback((evt) => {
    if (!evt) return;
    if (evt.type === 'ready' || evt.type === 'restart') {
      setHealth(evt.health);
      setMaxHealth(evt.maxHealth);
      setDead(false);
      setHurtFlash(false);
      setStatus(
        evt.type === 'restart'
          ? 'Encounter reset. Click to continue.'
          : 'Level loaded. Click the viewport to begin.',
      );
      return;
    }
    if (evt.type === 'playerDamage') {
      setHealth(evt.health);
      setHurtFlash(true);
      window.setTimeout(() => setHurtFlash(false), 120);
      setStatus(`You took ${evt.damage} damage · HP ${evt.health}`);
      return;
    }
    if (evt.type === 'playerDeath') {
      setDead(true);
      setHealth(0);
      setStatus('You died — press R to restart');
      return;
    }
    if (evt.type === 'preview') {
      setStatus(`Preview: ${evt.message}`);
    }
  }, []);

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <span className="title">BloodBound</span>
          <span className="subtitle">Phase 5 — Combat Visuals</span>
        </div>
        <div className="hud-right">
          {health != null && (
            <div className={`hp ${dead ? 'dead' : ''}`}>
              HP {health}/{maxHealth}
            </div>
          )}
          <div className={`status ${locked && !dead ? 'locked' : ''} ${dead ? 'dead' : ''}`}>
            {status}
          </div>
        </div>
      </header>

      <GameCanvas
        mapUrl={mapUrl}
        assetsUrl="/assets/assets.json"
        onReady={handleReady}
        onLockChange={handleLockChange}
        onError={handleError}
        onCombatEvent={handleCombatEvent}
        onHudEvent={handleHudEvent}
        onWeaponReady={handleWeaponReady}
      />

      <div className={`crosshair ${locked && !dead ? '' : 'hint'}`} aria-hidden="true">
        +
      </div>
      <div className={`hurt-flash ${hurtFlash ? 'active' : ''}`} aria-hidden="true" />
      {dead && (
        <div className="death-banner" aria-live="polite">
          You died — press <kbd>R</kbd> to restart
        </div>
      )}
      <WeaponPosePanel weaponView={weaponView} weaponId={weaponId} />
    </div>
  );
}
