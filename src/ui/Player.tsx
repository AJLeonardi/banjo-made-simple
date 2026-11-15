// Plays a tab with you: scrolls the tab, shows where your fingers go, listens, judges.
// Used by lessons, the song library, trading and the daily workout.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Band, previewEvent } from '../audio/band';
import { judge, rankChords } from '../audio/matcher';
import type { PickEvent } from '../audio/picker';
import type { StrumEvent } from '../audio/listener';
import { Performance, Target } from '../game/performance';
import { likelyPosition, noteName, OPEN } from '../music/banjo';
import { CHORD_BY_ID, Voicing } from '../music/library';
import { midiName } from '../music/notes';
import { Tab, TabEvent, tabDuration } from '../music/tab';
import { starsFor } from '../state/progress';
import { useStore } from '../state/store';
import { keepAwake } from '../wakelock';
import { useEngine } from './EngineContext';
import { Fretboard, Ghost, instruction, Mark } from './Fretboard';
import { Highway } from './Highway';
import { EarIcon, MicIcon, PlayIcon, StopIcon } from './Icons';
import { MicStatus } from './MicStatus';
import { stopNarration } from './narrator';

export interface PlayResult {
  mode: 'wait' | 'tempo';
  stars: number;
  accuracy: number;
  summary: ReturnType<Performance['summary']>;
  perfect: boolean;
  seconds: number;
}

export interface PlayerProps {
  tab: Tab;
  mode: 'wait' | 'tempo';
  bpm: number;
  /** Play the band along (tempo mode). */
  backing?: boolean;
  /** Banjo the app plays itself while you play (its break when trading). */
  appBanjo?: TabEvent[];
  /** Vamp chops the app plays behind your break (headphones only). */
  appChops?: TabEvent[];
  chordTimingOnly?: boolean;
  /** Max stars this run can earn. */
  starCap?: number;
  prompt?: string;
  startLabel?: string;
  /** Start as soon as mounted (the mic must already be on). */
  autoStart?: boolean;
  onDone: (r: PlayResult) => void;
}

type Phase = 'ready' | 'demo' | 'countin' | 'playing' | 'finishing';

interface Fb {
  result: 'hit' | 'wrong' | 'partial';
  target: Target;
  heard?: number[];
  heardChord?: string | null;
  at: number;
}

const PRAISE = ['Nice!', 'Good!', 'Yes!', 'Clean!', 'That\'s it!'];

function voicingFor(t: Target): Voicing {
  const c = CHORD_BY_ID[t.chord!];
  return c.voicings.find((v) => v.frets.join() === t.frets?.join()) ?? c.voicings[0];
}

const marksOf = (e: TabEvent | undefined): Mark[] => (e ? e.notes.map((n) => ({ string: n.string, fret: n.fret, lh: n.lh, rh: e.kind === 'pick' ? n.rh : undefined })) : []);

export function Player(props: PlayerProps) {
  const { tab, mode, bpm, backing = false, appBanjo, appChops, chordTimingOnly, starCap = 3, prompt, startLabel, autoStart, onDone } = props;
  const { settings } = useStore();
  const { engine, error, start: startMic } = useEngine();
  const spb = 60 / bpm;
  const [phase, setPhase] = useState<Phase>('ready');
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);
  const [fb, setFb] = useState<Fb | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [debugLine, setDebugLine] = useState('');

  const perf = useMemo(() => new Performance(tab, { mode, secPerBeat: spb, chordTimingOnly }), [tab, mode, spb, chordTimingOnly]);
  const perfRef = useRef(perf);
  perfRef.current = perf;
  const startRef = useRef(0);
  const bandRef = useRef<Band | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const waitPos = useRef(-1);
  const ignoreUntil = useRef(0);
  const wallStart = useRef(0);
  const doneRef = useRef(false);
  const lastCurrent = useRef<number | null>(null);
  const hintTimer = useRef(0);

  const latency = settings.latencyMs / 1000;
  const outLat = engine ? ((engine.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? engine.ctx.baseLatency ?? 0) : 0;
  const endBeat = tabDuration(tab);

  useEffect(() => () => cleanup.current(), []);
  useEffect(() => {
    return () => clearTimeout(hintTimer.current);
  }, []);
  // Let a feedback message fade out on its own.
  useEffect(() => {
    if (!fb) return;
    const t = window.setTimeout(rerender, 1900);
    return () => clearTimeout(t);
  }, [fb, rerender]);

  /** Current position in beats, for the highway. */
  const position = useCallback(() => {
    const ctx = engine?.ctx;
    if ((phase === 'playing' || phase === 'countin' || phase === 'demo') && ctx && (mode === 'tempo' || phase === 'demo')) {
      return (ctx.currentTime - outLat - startRef.current) / spb;
    }
    if (mode === 'wait' && (phase === 'playing' || phase === 'finishing')) {
      const cur = perfRef.current.current;
      const target = cur ? cur.beat : endBeat;
      waitPos.current += (target - 0.15 - waitPos.current) * 0.12;
      return waitPos.current;
    }
    return -1;
  }, [engine, phase, mode, spb, outLat, endBeat]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cleanup.current();
    keepAwake(false);
    const p = perfRef.current;
    p.finish();
    const s = p.summary();
    const seconds = Math.min((performance.now() - wallStart.current) / 1000, Math.max(30, s.judged * 15));
    const stars = mode === 'wait' ? Math.max(1, starsFor(s.accuracy, starCap)) : starsFor(s.accuracy, starCap);
    setPhase('finishing');
    rerender();
    window.setTimeout(() => onDone({ mode, stars, accuracy: s.accuracy, summary: s, perfect: mode === 'tempo' && s.hits === s.judged && s.judged > 0, seconds }), mode === 'wait' ? 500 : 900);
  }, [mode, starCap, onDone, rerender]);

  // ---- detection ----------------------------------------------------------------
  const attach = useCallback(
    (eng: NonNullable<typeof engine>) => {
      const ctx = eng.ctx;
      const timeOf = (onset: number) => onset - latency - startRef.current;
      eng.strumFirstCheck = tab.events.some((e) => e.style === 'chop') ? 0.14 : 0.2;

      const offPick = eng.onPick((ev: PickEvent) => {
        if (ctx.currentTime < ignoreUntil.current || doneRef.current) return;
        if (settings.debug) setDebugLine(`pick ${ev.heard.map(midiName).join('+')} fresh ${ev.fresh.toFixed(2)} str ${ev.strength.toFixed(1)}`);
        const r = perfRef.current.pick(timeOf(ev.onsetTime), ev.heard);
        if (r.result === 'hit' || r.result === 'wrong' || r.result === 'partial') {
          setFb({ result: r.result, target: r.target!, heard: ev.heard, at: performance.now() });
          rerender();
          if (mode === 'wait' && perfRef.current.done) finish();
        }
      });
      const offStrum = eng.onStrum((ev: StrumEvent) => {
        if (ctx.currentTime < ignoreUntil.current || doneRef.current) return;
        const p = perfRef.current;
        const t = timeOf(ev.onsetTime);
        const target =
          mode === 'wait'
            ? p.current
            : p.targets
                .filter((x) => x.kind === 'chord' && x.outcome === 'pending' && Math.abs(x.time - t) <= p.windowFor(x) + 0.02)
                .sort((a, b) => Math.abs(a.time - t) - Math.abs(b.time - t))[0];
        if (settings.debug) setDebugLine(`strum ${rankChords(ev.analysis).map((r) => `${r.name} ${r.score.toFixed(2)}`).join(', ')}${ev.final ? ' (final)' : ''}`);
        if (!target || target.kind !== 'chord') return;
        const j = judge(ev.analysis, voicingFor(target), { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 });
        const r = p.strum(t, j.verdict, j.heard, ev.final);
        if (settings.debug) console.debug(`[strum] t=${t.toFixed(2)} ${j.verdict} ${j.heard} final=${ev.final} → ${r.result} attempts=${target.attempts}`);
        if (r.result === 'hit') eng.endGesture(0.15);
        if (r.result === 'hit' || r.result === 'wrong' || r.result === 'partial') {
          setFb({ result: r.result, target: r.target!, heardChord: j.heard, at: performance.now() });
          rerender();
          if (mode === 'wait' && p.done) finish();
        }
      });
      return () => {
        offPick();
        offStrum();
      };
    },
    [latency, tab, mode, settings.debug, rerender, finish],
  );

  // ---- run ------------------------------------------------------------------------
  const run = useCallback(async () => {
    stopNarration(); // the mic must not hear the voice
    const eng = await startMic();
    if (!eng) return;
    cleanup.current();
    doneRef.current = false;
    keepAwake(true);
    wallStart.current = performance.now();
    const ctx = eng.ctx;
    const detach = attach(eng);
    let raf = 0;
    let band: Band | null = null;

    if (mode === 'tempo') {
      const countIn = tab.beatsPerBar;
      startRef.current = ctx.currentTime + 0.4 + countIn * spb;
      band = new Band(ctx, settings.backing, settings.volume);
      band.start({ tab, secPerBeat: spb, start: startRef.current, countIn, backing, banjo: appBanjo, banjoChops: settings.backing === 'headphones' ? appChops : undefined });
      setPhase('countin');
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = ctx.currentTime - startRef.current;
        if (now < 0) {
          setCountdown(Math.ceil(-now / spb));
          return;
        }
        setCountdown(null);
        setPhase((ph) => (ph === 'countin' ? 'playing' : ph));
        let changed = perfRef.current.advance(now - latency).length > 0;
        // Keep the fretboard on the next note to play.
        const next = perfRef.current.targets.find((t) => t.judged && t.outcome === 'pending' && t.time >= now - 0.1)?.index ?? -1;
        if (next !== lastCurrent.current) {
          lastCurrent.current = next;
          changed = true;
        }
        if (changed) rerender();
        if (now > endBeat * spb + 0.8) finish();
      };
      loop();
    } else {
      waitPos.current = -1;
      setPhase('playing');
      let lastPoll = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const cur = perfRef.current.current;
        const idx = cur?.index ?? null;
        // Slide / hammer-on / pull-off: follow the pitch of the ringing string.
        if (cur?.tech && !doneRef.current && ctx.currentTime - lastPoll > 0.06) {
          lastPoll = ctx.currentTime;
          const r = eng.readPitch(0.12);
          const midi = r && r.rms > 0.003 ? r.midi : null;
          const res = perfRef.current.pitch(ctx.currentTime - 0.06 - latency - startRef.current, midi);
          if (res.result === 'hit' || res.result === 'wrong') {
            setFb({ result: res.result, target: res.target!, heard: midi === null ? [] : [midi], at: performance.now() });
            rerender();
            if (perfRef.current.done) finish();
          }
        }
        if (idx !== lastCurrent.current) {
          lastCurrent.current = idx;
          setHint(false);
          clearTimeout(hintTimer.current);
          hintTimer.current = window.setTimeout(() => setHint(true), 6000);
        }
      };
      loop();
    }
    bandRef.current = band;
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      band?.stop();
      detach();
      clearTimeout(hintTimer.current);
      cleanup.current = () => {};
    };
  }, [startMic, attach, mode, tab, spb, settings.backing, settings.volume, backing, appBanjo, appChops, latency, endBeat, finish, rerender]);

  useEffect(() => {
    if (autoStart && engine && phase === 'ready') void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, engine]);

  /** Listen: the app plays the part (with the band) while the tab scrolls. */
  const demo = useCallback(async () => {
    stopNarration();
    const eng = await startMic();
    if (!eng) return;
    cleanup.current();
    const ctx = eng.ctx;
    startRef.current = ctx.currentTime + 0.4 + tab.beatsPerBar * spb;
    const band = new Band(ctx, 'headphones', settings.volume);
    band.start({ tab, secPerBeat: spb, start: startRef.current, countIn: tab.beatsPerBar, backing: true, banjo: tab.events });
    setPhase('demo');
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (ctx.currentTime - startRef.current > endBeat * spb + 0.5) stopDemo();
    };
    const stopDemo = () => {
      cancelAnimationFrame(raf);
      band.stop();
      setPhase('ready');
      cleanup.current = () => {};
    };
    loop();
    cleanup.current = stopDemo;
  }, [startMic, tab, spb, settings.volume, endBeat]);

  const hearIt = () => {
    const cur = perfRef.current.current;
    if (!engine || !cur) return;
    ignoreUntil.current = engine.ctx.currentTime + 1.3;
    previewEvent(engine.ctx, cur.event);
  };

  // ---- what to show ---------------------------------------------------------------
  const nowSec = engine && mode === 'tempo' ? engine.ctx.currentTime - startRef.current : 0;
  const shownTarget: Target | null =
    phase === 'ready' || phase === 'demo'
      ? perf.targets[0] ?? null
      : mode === 'wait'
        ? perf.current
        : perf.targets.find((t) => t.judged && t.outcome === 'pending' && t.time >= nowSec - 0.1) ?? null;
  const targetMarks = marksOf(shownTarget?.event);

  const fresh = fb && performance.now() - fb.at < 1800 ? fb : null;
  const ghosts: Ghost[] = [];
  let message = '';
  let msgClass = '';
  if (fresh) {
    const exp = fresh.target.event.notes[0];
    if (fresh.target.kind === 'pick') {
      for (const m of fresh.heard ?? []) {
        const ok = fresh.target.pitches.includes(m);
        const p = ok ? fresh.target.event.notes.find((n) => OPEN[n.string] + n.fret === m) ?? likelyPosition(m, exp) : likelyPosition(m, exp);
        if (p) ghosts.push({ string: p.string, fret: p.fret, label: noteName(m), ok });
      }
    }
    const tech = fresh.target.tech;
    const base = tech ? perf.targets[fresh.target.base!]?.event.notes[0] : undefined;
    const techWord = tech === 's' ? 'slide' : tech === 'h' ? 'hammer-on' : 'pull-off';
    if (tech && fresh.result === 'hit') {
      message = tech === 's' ? 'Smooth slide!' : tech === 'h' ? 'Nice hammer-on!' : 'Clean pull-off!';
      msgClass = 'hit';
    } else if (tech && fresh.result === 'wrong') {
      message = `The ${techWord} didn't reach ${exp.fret ? `fret ${exp.fret}` : 'the open string'} — pick ${base?.fret ? `fret ${base.fret}` : 'the string'} again and try once more`;
      msgClass = 'wrong';
    } else if (fresh.result === 'hit') {
      const off = fresh.target.offset;
      message = off !== undefined && Math.abs(off) > 0.08 ? (off < 0 ? 'A little early' : 'A little late') : PRAISE[fresh.target.index % PRAISE.length];
      msgClass = 'hit';
    } else if (fresh.result === 'partial') {
      message = fresh.target.kind === 'pick' ? 'Pick both strings together' : 'Strum all four strings';
      msgClass = 'partial';
    } else {
      msgClass = 'wrong';
      if (fresh.target.kind === 'chord') message = fresh.heardChord ? `That sounded like ${fresh.heardChord} — try ${fresh.target.chord}` : `Make the ${fresh.target.chord} shape and strum all four strings`;
      else if (fresh.heard?.length) {
        const g = ghosts.find((x) => !x.ok);
        message = g ? `You played ${noteName(fresh.heard[0])} (${g.string === 5 ? '5th string' : `string ${g.string}${g.fret ? `, fret ${g.fret}` : ', open'}`})` : 'Not quite';
      } else message = 'Not quite';
    }
  }

  const running = phase === 'playing' || phase === 'countin';
  const curChord = shownTarget?.kind === 'chord' ? shownTarget.chord : null;

  return (
    <div className={`player${running || phase === 'finishing' || phase === 'demo' ? ' running' : ''}`}>
      {prompt && <p className="muted player-prompt">{prompt}</p>}
      <div className="highway-wrap player-main">
        <Highway tab={tab} targets={running || phase === 'finishing' ? perf.targets : undefined} position={position} currentIndex={mode === 'wait' && running ? perf.current?.index ?? null : null} pxPerBeat={mode === 'wait' ? 96 : 84} />
        {countdown !== null && <div className="countin" aria-live="polite">{countdown}</div>}
      </div>

      <div className="player-status">
        <div className={`feedback ${msgClass}`} aria-live="polite">
          {message || (curChord && running ? '' : ' ')}
        </div>
        {curChord && (
          <div className="chord-callout">
            <span className="name">{curChord}</span>
            <span className="muted small">{shownTarget?.event.style === 'chop' ? 'chop — strum, then relax your hand' : 'strum'}</span>
          </div>
        )}
      </div>

      <div className="player-board">
        <Fretboard targets={targetMarks} ghosts={ghosts} />
        <div className="legend" aria-hidden>
          <span><i style={{ background: 'var(--rh-t)' }} />Thumb</span>
          <span><i style={{ background: 'var(--rh-i)' }} />Index</span>
          <span><i style={{ background: 'var(--rh-m)' }} />Middle</span>
          <span><i style={{ background: 'var(--brass)' }} />Fret here (finger number)</span>
        </div>
      </div>

      <div className="player-controls">

      {mode === 'wait' && running && shownTarget?.tech && <div className="hint">{techHint(shownTarget, perf)}</div>}
      {hint && mode === 'wait' && running && shownTarget && !shownTarget.tech && <div className="hint">{shownTarget.kind === 'chord' ? `Make the ${shownTarget.chord} shape shown on the fretboard, then strum.` : instruction(targetMarks)}</div>}

      {error && <div className="error">{error}</div>}
      {engine && (running || phase === 'demo') && <MicStatus engine={engine} />}
      {settings.debug && debugLine && <div className="debug">{debugLine}</div>}

      <div className="row">
        {phase === 'ready' && (
          <>
            <button className="btn primary grow" onClick={run}>
              {engine ? <PlayIcon /> : <MicIcon />} {startLabel ?? (engine ? 'Start' : 'Start — turn on mic')}
            </button>
            <button className="btn" onClick={demo} aria-label="Listen to it first">
              <EarIcon /> Listen
            </button>
          </>
        )}
        {phase === 'demo' && (
          <button className="btn grow" onClick={() => cleanup.current()}>
            <StopIcon /> Stop listening
          </button>
        )}
        {running && mode === 'wait' && (
          <button className="btn grow" onClick={hearIt}>
            <EarIcon /> Hear this note
          </button>
        )}
        {running && (
          <button className="btn" onClick={finish}>
            <StopIcon /> {mode === 'wait' ? 'Finish' : 'Stop'}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

/** What to do for a slide / hammer-on / pull-off, without picking again. */
function techHint(t: Target, perf: Performance): string {
  const to = t.event.notes[0];
  const from = perf.targets[t.base!]?.event.notes[0];
  const where = (f: number) => (f ? `fret ${f}` : 'open');
  if (t.tech === 's') return `Don't pick again — keep pressing and slide your finger from ${where(from?.fret ?? 0)} up to ${where(to.fret)} while the note rings.`;
  if (t.tech === 'h') return `Don't pick again — bring your finger down hard on ${where(to.fret)} so the string sounds by itself.`;
  return `Don't pick again — pull your finger off ${where(from?.fret ?? 0)} with a little sideways flick so the ${where(to.fret)} note sounds.`;
}
