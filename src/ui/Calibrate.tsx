// Timing calibration (from banjo-flash-cards): strum along with clicks; the median offset
// becomes the latency correction applied to every note.
import { useEffect, useRef, useState } from 'react';
import { Metronome } from '../audio/metronome';
import { useStore } from '../state/store';
import { useEngine } from './EngineContext';
import { MicIcon } from './Icons';
import { MicStatus } from './MicStatus';

const BPM = 80;
const LEAD = 4;
const COUNT = 12;

export function Calibrate() {
  const { settings, setSettings } = useStore();
  const { engine, error, start: startMic } = useEngine();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [heard, setHeard] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const start = async () => {
    const eng = await startMic();
    if (!eng) return;
    const ctx = eng.ctx;
    const t0 = ctx.currentTime + 0.5;
    const beat = 60 / BPM;
    const clicks = Array.from({ length: LEAD + COUNT }, (_, i) => t0 + i * beat);
    const metro = new Metronome(ctx, 0.8);
    metro.start(t0, BPM, 4, clicks[clicks.length - 1]);
    const offsets: number[] = [];
    let last = -1;
    const off = eng.onStrum((ev) => {
      if (ev.onsetTime === last) return; // one strum is checked several times
      last = ev.onsetTime;
      const near = clicks.slice(LEAD).reduce((a, b) => (Math.abs(b - ev.onsetTime) < Math.abs(a - ev.onsetTime) ? b : a));
      const d = ev.onsetTime - near;
      if (Math.abs(d) < 0.35) {
        offsets.push(d);
        setHeard(offsets.length);
      }
    });
    const timer = window.setTimeout(() => {
      off();
      if (offsets.length < 5) return setState('failed');
      const sorted = [...offsets].sort((a, b) => a - b);
      const ms = Math.round(sorted[Math.floor(sorted.length / 2)] * 1000);
      setResult(ms);
      setSettings({ latencyMs: ms });
      setState('done');
    }, (clicks[clicks.length - 1] - ctx.currentTime + 0.6) * 1000);
    cleanup.current = () => {
      metro.stop();
      off();
      clearTimeout(timer);
    };
    setHeard(0);
    setState('running');
  };

  return (
    <div className="card stack">
      <h2>Timing calibration</h2>
      <p className="small">
        Phones and Bluetooth headphones add a delay between a sound and what the mic hears. After 4 count-in clicks, strum any chord exactly on each of the next {COUNT} clicks. Use the same
        headphones or speaker you play with.
      </p>
      {engine && <MicStatus engine={engine} />}
      {state === 'running' && <div className="countin" style={{ position: 'static' }}>{heard}/{COUNT}</div>}
      {state === 'done' && <div className="banner">Timing set to {result} ms</div>}
      {state === 'failed' && <div className="error">Only heard {heard} strums — try again, a bit louder or closer to the mic.</div>}
      {error && <div className="error">{error}</div>}
      <div className="muted small">Current correction: {settings.latencyMs} ms</div>
      <button className="btn primary" disabled={state === 'running'} onClick={start}>
        <MicIcon /> {state === 'idle' ? 'Start' : 'Run again'}
      </button>
    </div>
  );
}
