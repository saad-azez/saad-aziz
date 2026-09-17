import { useEffect, useState } from 'react';
import { SEQUENCE_BEATS } from '../../webgl/hero/SignatureSequence.js';
import './AnimationDebug.css';

// Convert the choreography clock to the existing timeline's real duration.
function wallTime(phase) {
  let previous = 0, elapsed = 0;
  for (const [end, duration] of SEQUENCE_BEATS) {
    if (phase <= end) return elapsed + duration * (phase - previous) / (end - previous);
    previous = end; elapsed += duration;
  }
  return elapsed;
}

export default function AnimationDebug({ sceneRef, ready, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snapshot, setSnapshot] = useState({ time: 0, phase: 'loader', playing: false });
  const refresh = () => {
    const scene = sceneRef.current;
    if (scene) setSnapshot({ time: scene.sequence.clock.time, phase: scene.sequence.phase,
      playing: !!(scene.entrance && !scene.entrance.paused()) });
  };
  useEffect(() => {
    if (!open) return;
    refresh();
    const timer = setInterval(refresh, 80);
    return () => clearInterval(timer);
  }, [open]);

  const timeline = () => {
    const scene = sceneRef.current;
    if (!scene?.visible) return null;
    if (!scene.entrance) { scene.sequence.reset(); scene.entrance = scene.sequence.play(0).pause(); }
    scene.entrance.delay(0).timeScale(speed);
    return scene.entrance;
  };
  const seek = time => {
    const t = Math.max(0, Math.min(2.9, time));
    timeline()?.pause().time(wallTime(t), false);
    refresh();
  };
  const togglePlay = () => {
    if (snapshot.playing) sceneRef.current?.entrance?.pause();
    else {
      const t = snapshot.time >= 2.899 ? 0 : snapshot.time;
      timeline()?.time(wallTime(t), false).play();
    }
    refresh();
  };
  return <aside className={`animation-debug${open ? ' animation-debug--open' : ''}`}>
    <button className="animation-debug__toggle" aria-expanded={open} aria-controls="animation-debug-panel"
      onClick={() => { setOpen(!open); onOpenChange(!open); }}>{open ? 'Close controls' : 'Animation controls'}</button>
    {open && <div className="animation-debug__panel" id="animation-debug-panel" role="region" aria-label="Animation controls">
      <h2>Signature animation</h2>
      <p className="animation-debug__hint">General playback controls</p>
      <fieldset disabled={!ready}>
        <div className="animation-debug__buttons">
          <button onClick={togglePlay}>{snapshot.playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => { seek(0); timeline()?.play(); refresh(); }}>Restart</button>
        </div>
        <label>Timeline <output>{snapshot.time.toFixed(3)} · {snapshot.phase}</output>
          <input aria-label="Timeline" type="range" min="0" max="2.9" step=".005" value={snapshot.time}
            onChange={e => seek(Number(e.target.value))} />
        </label>
        <div className="animation-debug__buttons">
          <button onClick={() => seek(snapshot.time - 1 / 30)}>−1 frame</button>
          <button onClick={() => seek(snapshot.time + 1 / 30)}>+1 frame</button>
        </div>
        <label>Playback speed <output>{speed.toFixed(2)}×</output>
          <input aria-label="Playback speed" type="range" min=".1" max="2" step=".05" value={speed}
            onChange={e => { const v = Number(e.target.value); setSpeed(v); sceneRef.current?.entrance?.timeScale(v); refresh(); }} />
        </label>
      </fieldset>
      <p className="animation-debug__hint" role="status">{ready ? '' : 'Waiting for the loader to finish…'}</p>
    </div>}
  </aside>;
}
