// Tuner: pick an open string; the needle shows how sharp or flat it is.
import { useEffect, useRef, useState } from 'react';
import { banjoBuffer, playBuffer } from '../audio/voices';
import { nearestString } from '../audio/tuner';
import { OPEN, STRING_NAMES, StringNum } from '../music/banjo';
import { NOTE_NAMES } from '../music/notes';
import { useEngine } from './EngineContext';
import { MicIcon, SpeakerIcon } from './Icons';
import { MicStatus } from './MicStatus';

export function Tuner({ onTuned }: { onTuned?: () => void }) {
  const { engine, error, start } = useEngine();
  const [reading, setReading] = useState<{ s: StringNum; cents: number; note: string } | null>(null);
  const [tuned, setTuned] = useState<Set<StringNum>>(new Set());
  const steady = useRef<{ s: StringNum; since: number } | null>(null);
  const tunedRef = useRef<Set<StringNum>>(new Set());

  useEffect(() => {
    if (!engine) return;
    const t = window.setInterval(() => {
      const r = engine.readPitch();
      if (!r || r.rms < 0.004) {
        steady.current = null;
        return;
      }
      const exact = r.midi + r.cents / 100;
      const s = nearestString(exact);
      const cents = Math.round((exact - OPEN[s]) * 100);
      if (Math.abs(cents) > 150) return; // nowhere near a banjo string
      setReading({ s, cents, note: NOTE_NAMES[r.midi % 12] });
      if (Math.abs(cents) <= 5) {
        if (!steady.current || steady.current.s !== s) steady.current = { s, since: performance.now() };
        else if (performance.now() - steady.current.since > 700 && !tunedRef.current.has(s)) {
          tunedRef.current = new Set(tunedRef.current).add(s);
          setTuned(tunedRef.current);
          onTuned?.();
        }
      } else steady.current = null;
    }, 100);
    return () => clearInterval(t);
  }, [engine, onTuned]);

  const ref = (s: StringNum) => {
    if (!engine) return;
    playBuffer(engine.ctx, engine.ctx.destination, banjoBuffer(engine.ctx, OPEN[s]), engine.ctx.currentTime + 0.02, 0.5);
  };

  const cents = reading?.cents ?? 0;
  const ok = reading && Math.abs(cents) <= 5;
  return (
    <div className="tuner card">
      {!engine ? (
        <>
          <p className="center">Pick one string at a time and let it ring. The tuner shows whether to tighten (sharp) or loosen (flat).</p>
          <button className="btn primary" onClick={start}>
            <MicIcon /> Turn on the tuner
          </button>
          {error && <div className="error">{error}</div>}
        </>
      ) : (
        <>
          <div className="tuner-note" aria-live="polite">{reading ? NOTE_NAMES[OPEN[reading.s] % 12] : '—'}</div>
          <div className="muted">{reading ? `${STRING_NAMES[reading.s]} string · ${cents > 0 ? '+' : ''}${cents} cents` : 'Pick an open string'}</div>
          <div className="tuner-gauge" aria-hidden>
            <div className="scale" />
            <div className="zone" />
            <div className={`needle${ok ? ' ok' : ''}`} style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }} />
          </div>
          <div className="feedback" style={{ color: ok ? 'var(--good)' : 'var(--ink-soft)' }}>
            {!reading ? '' : ok ? 'In tune!' : cents > 0 ? 'Too high — loosen a little' : 'Too low — tighten a little'}
          </div>
          <div className="chips" role="group" aria-label="Play a reference note">
            {([5, 4, 3, 2, 1] as StringNum[]).map((s) => (
              <button key={s} className="chip" aria-pressed={tuned.has(s)} onClick={() => ref(s)}>
                <SpeakerIcon /> {s}: {NOTE_NAMES[OPEN[s] % 12]}
                {s === 5 ? ' (high)' : ''}
              </button>
            ))}
          </div>
          <p className="tiny muted">Tap a string button to hear its note. Tuned strings turn dark.</p>
          <MicStatus engine={engine} />
        </>
      )}
    </div>
  );
}
