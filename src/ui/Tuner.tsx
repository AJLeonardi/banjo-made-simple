// Tuner. Free mode: pick any open string; the needle shows how sharp or flat it is.
// Guided mode (the tuning lesson): walks through the strings one at a time — 4th, 3rd,
// 2nd, 1st, then the short 5th — and moves on once each holds in tune.
import { useEffect, useRef, useState } from 'react';
import { banjoBuffer, playBuffer } from '../audio/voices';
import { nearestString } from '../audio/tuner';
import { OPEN, STRING_NAMES, StringNum } from '../music/banjo';
import { NOTE_NAMES } from '../music/notes';
import { CheckIcon, MicIcon, SpeakerIcon } from './Icons';
import { useEngine } from './EngineContext';
import { MicStatus } from './MicStatus';

export const GUIDED_ORDER: StringNum[] = [4, 3, 2, 1, 5];
const IN_TUNE_CENTS = 5;
const HOLD_MS = 700;

interface Reading {
  s: StringNum;
  /** Cents from the string's correct pitch (can be large when far off). */
  cents: number;
}

export function Tuner({ onTuned, guided = false, onComplete }: { onTuned?: () => void; guided?: boolean; onComplete?: () => void }) {
  const { engine, error, start } = useEngine();
  const [reading, setReading] = useState<Reading | null>(null);
  const [tuned, setTuned] = useState<Set<StringNum>>(new Set());
  const [step, setStep] = useState(0);
  const steady = useRef<{ s: StringNum; since: number } | null>(null);
  const tunedRef = useRef<Set<StringNum>>(new Set());
  const stepRef = useRef(0);
  stepRef.current = step;
  const target: StringNum | null = guided ? GUIDED_ORDER[step] ?? null : null;
  const complete = guided && step >= GUIDED_ORDER.length;

  useEffect(() => {
    if (!engine) return;
    const t = window.setInterval(() => {
      const r = engine.readPitch();
      if (!r || r.rms < 0.004) {
        steady.current = null;
        return;
      }
      const exact = r.midi + r.cents / 100;
      let s: StringNum;
      let diff: number;
      const want = guided ? GUIDED_ORDER[stepRef.current] : null;
      if (want) {
        // We know which string is being tuned: fold octave slips onto it, and ignore
        // anything more than a fifth away (another string ringing, a voice…).
        // A string you just tuned keeps ringing: don't read it as this one being way off.
        if ([...tunedRef.current].some((d) => d !== want && Math.abs(exact - OPEN[d]) < 0.3 && Math.abs(exact - OPEN[want]) > 0.5)) return;
        s = want;
        diff = exact - OPEN[want];
        if (Math.abs(diff - 12) < Math.abs(diff)) diff -= 12;
        else if (Math.abs(diff + 12) < Math.abs(diff)) diff += 12;
        if (Math.abs(diff) > 7) return;
      } else {
        s = nearestString(exact);
        diff = exact - OPEN[s];
        if (Math.abs(diff) > 1.5) return; // nowhere near a banjo string
      }
      const cents = Math.round(diff * 100);
      setReading({ s, cents });
      if (Math.abs(cents) <= IN_TUNE_CENTS) {
        if (!steady.current || steady.current.s !== s) steady.current = { s, since: performance.now() };
        else if (performance.now() - steady.current.since > HOLD_MS && !tunedRef.current.has(s)) {
          tunedRef.current = new Set(tunedRef.current).add(s);
          setTuned(tunedRef.current);
          onTuned?.();
          if (want) advance();
        }
      } else steady.current = null;
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, onTuned, guided]);

  const advance = () => {
    steady.current = null;
    setReading(null);
    const next = stepRef.current + 1;
    stepRef.current = next;
    setStep(next);
    if (next >= GUIDED_ORDER.length) onComplete?.();
  };

  const ref = (s: StringNum) => {
    if (!engine) return;
    playBuffer(engine.ctx, engine.ctx.destination, banjoBuffer(engine.ctx, OPEN[s]), engine.ctx.currentTime + 0.02, 0.5);
  };

  const cents = reading?.cents ?? 0;
  const ok = !!reading && Math.abs(cents) <= IN_TUNE_CENTS;
  const advice = !reading ? '' : ok ? 'In tune!' : advise(cents);
  const shownString = target ?? reading?.s ?? null;

  if (!engine)
    return (
      <div className="tuner card">
        <p className="center">Pick one string at a time and let it ring. The tuner shows whether to tighten (too low) or loosen (too high).</p>
        <button className="btn primary" onClick={start}>
          <MicIcon /> Turn on the tuner
        </button>
        {error && <div className="error">{error}</div>}
      </div>
    );

  return (
    <div className="tuner card">
      {guided && (
        <div className="chips" aria-label="Strings">
          {GUIDED_ORDER.map((s, k) => (
            <span key={s} className="chip" aria-pressed={k === step} style={tuned.has(s) ? { borderColor: 'var(--good)', color: 'var(--good)' } : undefined}>
              {tuned.has(s) && <CheckIcon />} {s}: {NOTE_NAMES[OPEN[s] % 12]}
            </span>
          ))}
        </div>
      )}
      {complete ? (
        <div className="stack center" style={{ alignItems: 'center' }}>
          <div className="tuner-note" style={{ color: 'var(--good)' }}>✓</div>
          <b>All five strings are in tune.</b>
          <p className="small muted">Tuning drifts as you play and as the room warms up. Check it every time you pick up the banjo.</p>
        </div>
      ) : (
        <>
          {target && (
            <p className="center">
              <b>Pick the {STRING_NAMES[target]} string</b> and let it ring.
              {target === 5 && ' Its peg is on the side of the neck, at the 5th fret.'}
            </p>
          )}
          <div className="tuner-note" aria-live="polite">{shownString ? NOTE_NAMES[OPEN[shownString] % 12] : '—'}</div>
          <div className="muted">{reading ? `${STRING_NAMES[reading.s]} string · ${cents > 0 ? '+' : ''}${cents} cents` : guided ? 'Listening…' : 'Pick an open string'}</div>
          <div className="tuner-gauge" aria-hidden>
            <div className="scale" />
            <div className="zone" />
            <div className={`needle${ok ? ' ok' : ''}`} style={{ left: `${50 + Math.max(-50, Math.min(50, cents / 2))}%` }} />
          </div>
          <div className="feedback" style={{ color: ok ? 'var(--good)' : 'var(--ink-soft)' }}>
            {advice}
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            {target ? (
              <>
                <button className="btn small" onClick={() => ref(target)}>
                  <SpeakerIcon /> Hear the {NOTE_NAMES[OPEN[target] % 12]}
                </button>
                <button className="btn small ghost" onClick={advance}>Skip this string</button>
              </>
            ) : (
              ([5, 4, 3, 2, 1] as StringNum[]).map((s) => (
                <button key={s} className="chip" aria-pressed={tuned.has(s)} onClick={() => ref(s)}>
                  <SpeakerIcon /> {s}: {NOTE_NAMES[OPEN[s] % 12]}
                  {s === 5 ? ' (high)' : ''}
                </button>
              ))
            )}
          </div>
          {!guided && <p className="tiny muted">Tap a string button to hear its note. Tuned strings turn dark.</p>}
        </>
      )}
      <MicStatus engine={engine} />
    </div>
  );
}

/** Which way to turn, and roughly how far. */
export function advise(cents: number): string {
  const semis = Math.round(Math.abs(cents) / 100);
  const dir = cents > 0 ? 'Too high — loosen' : 'Too low — tighten';
  if (semis >= 2) return `${dir} (about ${semis} notes ${cents > 0 ? 'high' : 'low'})`;
  if (Math.abs(cents) > 40) return `${dir} a bit`;
  return `${dir} just a touch`;
}
