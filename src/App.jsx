import { useCallback, useState } from 'react';
import GameCanvas from './game/GameCanvas.jsx';
import './App.css';

export default function App() {
  const [status, setStatus] = useState('Loading level…');
  const [locked, setLocked] = useState(false);

  const handleLockChange = useCallback((isLocked) => {
    setLocked(isLocked);
    setStatus(
      isLocked
        ? 'WASD move · Mouse look · LMB fire · Esc release'
        : 'Click the viewport to capture the mouse.',
    );
  }, []);

  const handleReady = useCallback(() => {
    setStatus('Level loaded. Click the viewport to begin.');
  }, []);

  const handleError = useCallback((message) => {
    setStatus(`Error: ${message}`);
  }, []);

  const handleCombatEvent = useCallback((evt) => {
    if (!evt) return;
    if (evt.dead) {
      setStatus(`Target down (${evt.characterId})`);
    } else {
      setStatus(`Hit ${evt.characterId} for ${evt.damage} · HP ${evt.remaining}`);
    }
  }, []);

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <span className="title">BloodBound</span>
          <span className="subtitle">Phase 2 — Hybrid Combat Foundation</span>
        </div>
        <div className={`status ${locked ? 'locked' : ''}`}>{status}</div>
      </header>

      <GameCanvas
        mapUrl="/maps/test-level.json"
        assetsUrl="/assets/assets.json"
        onReady={handleReady}
        onLockChange={handleLockChange}
        onError={handleError}
        onCombatEvent={handleCombatEvent}
      />

      <div className={`crosshair ${locked ? '' : 'hint'}`} aria-hidden="true">
        +
      </div>
    </div>
  );
}
