import { useCallback, useState } from 'react';
import GameCanvas from './game/GameCanvas.jsx';
import './App.css';

export default function App() {
  const [status, setStatus] = useState('Loading level…');
  const [locked, setLocked] = useState(false);
  const [health, setHealth] = useState(null);
  const [maxHealth, setMaxHealth] = useState(100);
  const [hurtFlash, setHurtFlash] = useState(false);
  const [dead, setDead] = useState(false);

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
    }
  }, []);

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <span className="title">BloodBound</span>
          <span className="subtitle">Phase 3 — First Enemy Encounter</span>
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
        mapUrl="/maps/test-level.json"
        assetsUrl="/assets/assets.json"
        onReady={handleReady}
        onLockChange={handleLockChange}
        onError={handleError}
        onCombatEvent={handleCombatEvent}
        onHudEvent={handleHudEvent}
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
    </div>
  );
}
