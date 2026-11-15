import { useMemo, useRef, useState } from 'react';
import { ALL_LESSONS, isTab, LESSON_BY_ID, Step } from '../../content/lessons';
import { TUNE_BY_ID, TUNES, tuneTab } from '../../content/songs';
import { partTab, Tab } from '../../music/tab';
import { bump, completeLesson, lessonUnlocked, recordStep, tuneUnlocked } from '../../state/progress';
import { useStore } from '../../state/store';
import { Stars } from '../bits';
import { useMicScope } from '../EngineContext';
import { Figure } from '../Figures';
import { CloseIcon, HeadphonesIcon, NoteIcon, PlayIcon, RepeatIcon } from '../Icons';
import type { Nav } from '../nav';
import { Player, PlayResult } from '../Player';
import { recordRun } from '../record';
import { Results } from '../Results';
import { Tuner } from '../Tuner';

export function resolveTab(src: Extract<Step, { kind: 'play' }>['source']): Tab {
  return isTab(src) ? src : partTab(tuneTab(TUNE_BY_ID[src.tune], src.arrangement), src.part ?? 'all');
}

const scored = (s: Step) => s.kind === 'play' || s.kind === 'trade';

export function LessonScreen({ id, go }: { id: string; go: Nav }) {
  useMicScope();
  const lesson = LESSON_BY_ID[id];
  const { progress, update } = useStore();
  const [i, setI] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [best, setBest] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState<number | null>(null);
  const before = useRef(new Set(TUNES.filter((t) => tuneUnlocked(progress, t)).map((t) => t.id)));

  if (!lesson || !lessonUnlocked(progress, id)) {
    return (
      <div className="page full">
        <div className="card stack">
          <h2>This lesson is locked</h2>
          <p className="muted">Finish the lessons before it first.</p>
          <button className="btn primary" onClick={() => go({ name: 'learn' })}>Back to the path</button>
        </div>
      </div>
    );
  }

  const steps = lesson.steps;
  const step = steps[i];

  const onPlayDone = (r: PlayResult) => {
    setResult(r);
    setBest((b) => ({ ...b, [i]: Math.max(b[i] ?? 0, r.stars) }));
    update((p) => {
      let q = recordStep(recordRun(p, r), id, i, r.stars);
      if (step.kind === 'trade') q = bump(q, 'trades');
      return q;
    });
  };

  const advance = () => {
    setResult(null);
    setAttempt(0);
    if (i + 1 < steps.length) {
      setI(i + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    const scores = steps.map((s, k) => (scored(s) ? best[k] ?? 0 : null)).filter((x): x is number => x !== null);
    const stars = scores.length ? Math.min(...scores) : 3;
    update((p) => completeLesson(p, id, Math.max(1, stars)));
    setFinished(Math.max(1, stars));
  };

  const nextIdx = ALL_LESSONS.findIndex((l) => l.id === id) + 1;
  const nextLesson = ALL_LESSONS[nextIdx];

  if (finished !== null) {
    const fresh = TUNES.filter((t) => tuneUnlocked(progress, t) && !before.current.has(t.id));
    return (
      <div className="page full">
        <div className="card stack center" style={{ alignItems: 'center' }}>
          <h1 className="display">Lesson complete!</h1>
          <Stars n={finished} big />
          <p className="muted">{lesson.title}</p>
          {fresh.map((t) => (
            <button key={t.id} className="banner row" style={{ width: '100%', border: 'none', cursor: 'pointer' }} onClick={() => go({ name: 'song', id: t.id }, true)}>
              <NoteIcon /> <span className="grow">New tune unlocked: <b>{t.title}</b></span>
            </button>
          ))}
          <div className="row" style={{ justifyContent: 'center' }}>
            {nextLesson && lessonUnlocked(progress, nextLesson.id) && (
              <button className="btn primary" onClick={() => go({ name: 'lesson', id: nextLesson.id }, true)}>
                <PlayIcon /> Next: {nextLesson.title}
              </button>
            )}
            <button className="btn" onClick={() => go({ name: 'learn' })}>Back to the path</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page full">
      <div className="runner-top">
        <button className="iconbtn" onClick={() => go({ name: 'learn' })} aria-label="Close lesson">
          <CloseIcon />
        </button>
        <div className="steps" aria-label={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((_, k) => (
            <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />
          ))}
        </div>
      </div>

      {step.kind === 'info' && (
        <section className="stack">
          <h2 className="step-title display">{step.title}</h2>
          {step.figure && <Figure spec={step.figure} />}
          <div className="info-body">
            {step.body.map((p, k) => (
              <p key={k}>{p}</p>
            ))}
          </div>
          <button className="btn primary block" onClick={advance}>Continue</button>
        </section>
      )}

      {step.kind === 'tuner' && <TunerStep key={i} title={step.title} guided={!!step.guided} onTuned={() => update((p) => bump(p, 'tuner'))} onNext={advance} />}

      {step.kind === 'play' && <PlayStep key={`${i}:${attempt}`} step={step} result={result} onDone={onPlayDone} onRetry={() => { setResult(null); setAttempt((a) => a + 1); }} onNext={advance} />}

      {step.kind === 'trade' && (result ? (
        <section className="stack">
          <h2 className="step-title display">{step.title}</h2>
          <Results r={result} title="Breaks traded!">
            <button className="btn" onClick={() => { setResult(null); setAttempt((a) => a + 1); }}><RepeatIcon /> Again</button>
            <button className="btn primary" disabled={result.stars === 0} onClick={advance}>Continue</button>
          </Results>
        </section>
      ) : (
        <TradeStep key={`${i}:${attempt}`} step={step} onDone={onPlayDone} />
      ))}
    </div>
  );
}

function TunerStep({ title, guided, onTuned, onNext }: { title: string; guided: boolean; onTuned: () => void; onNext: () => void }) {
  const [complete, setComplete] = useState(false);
  return (
    <section className="stack">
      <h2 className="step-title display">{title}</h2>
      <p>{guided ? "We'll go string by string: 4th, 3rd, 2nd, 1st, then the short 5th. Pick the string, let it ring, and turn its peg until the needle sits in the green." : 'Tune each string to g D G B D (5th to 1st).'}</p>
      <Tuner guided={guided} onTuned={onTuned} onComplete={() => setComplete(true)} />
      <button className="btn primary block" disabled={guided && !complete} onClick={onNext}>
        {guided && !complete ? 'Tune all five strings to continue' : 'Continue'}
      </button>
      {guided && !complete && (
        <button className="btn ghost block" onClick={onNext}>
          Skip for now
        </button>
      )}
    </section>
  );
}

function PlayStep({ step, result, onDone, onRetry, onNext }: { step: Extract<Step, { kind: 'play' }>; result: PlayResult | null; onDone: (r: PlayResult) => void; onRetry: () => void; onNext: () => void }) {
  const tab = useMemo(() => resolveTab(step.source), [step.source]);
  const tune = !isTab(step.source) ? TUNE_BY_ID[step.source.tune] : null;
  const bpm = step.bpm ?? (tune ? Math.round(tune.bpm * 0.7) : 70);
  return (
    <section className="stack">
      <h2 className="step-title display">{step.title}</h2>
      {result ? (
        <Results r={result}>
          <button className="btn" onClick={onRetry}><RepeatIcon /> Try again</button>
          <button className="btn primary" disabled={result.stars === 0} onClick={onNext}>Continue</button>
        </Results>
      ) : (
        <Player tab={tab} mode={step.mode} bpm={bpm} backing={step.backing} prompt={`${step.prompt}${step.mode === 'tempo' ? ` (${bpm} bpm)` : ''}`} onDone={onDone} />
      )}
    </section>
  );
}

function TradeStep({ step, onDone }: { step: Extract<Step, { kind: 'trade' }>; onDone: (r: PlayResult) => void }) {
  const { settings, setSettings } = useStore();
  const tune = TUNE_BY_ID[step.tune];
  const bpm = step.bpm ?? tune.bpm;
  const lead = useMemo(() => tuneTab(tune, step.lead), [tune, step.lead]);
  const backup = useMemo(() => tuneTab(tune, 'backup'), [tune]);
  const [round, setRound] = useState<1 | 2>(1);
  const [r1, setR1] = useState<PlayResult | null>(null);
  const speaker = settings.backing === 'speaker';

  const combine = (a: PlayResult, b: PlayResult): PlayResult => ({
    mode: 'tempo',
    stars: Math.min(a.stars, b.stars),
    accuracy: (a.accuracy + b.accuracy) / 2,
    perfect: a.perfect && b.perfect,
    seconds: a.seconds + b.seconds,
    summary: {
      judged: a.summary.judged + b.summary.judged,
      hits: a.summary.hits + b.summary.hits,
      partials: a.summary.partials + b.summary.partials,
      wrong: a.summary.wrong + b.summary.wrong,
      wrongTries: a.summary.wrongTries + b.summary.wrongTries,
      misses: a.summary.misses + b.summary.misses,
      accuracy: (a.accuracy + b.accuracy) / 2,
      timing: a.summary.timing ?? b.summary.timing,
      pickHits: a.summary.pickHits + b.summary.pickHits,
      chordHits: a.summary.chordHits + b.summary.chordHits,
    },
  });

  return (
    <section className="stack">
      <h2 className="step-title display">{step.title}</h2>
      {speaker && (
        <div className="banner row">
          <HeadphonesIcon />
          <span className="grow small">
            Using the speaker: when the app takes its break, we can only check your timing. With headphones we can check your chords too.
          </span>
          <button className="btn small" onClick={() => setSettings({ backing: 'headphones' })}>I have headphones</button>
        </div>
      )}
      {round === 1 && !r1 && (
        <>
          <h3>Round 1 — your break</h3>
          <Player tab={lead} mode="tempo" bpm={bpm} backing appChops={backup.events} prompt={`${step.prompt} Play the melody (${bpm} bpm).`} startLabel="Take your break" onDone={setR1} />
        </>
      )}
      {round === 1 && r1 && (
        <Results r={r1} title="Your break">
          <button className="btn primary" onClick={() => setRound(2)}>Round 2 — your backup</button>
        </Results>
      )}
      {round === 2 && (
        <>
          <h3>Round 2 — backup</h3>
          <Player
            tab={backup}
            mode="tempo"
            bpm={bpm}
            backing
            appBanjo={lead.events}
            chordTimingOnly={speaker}
            prompt="Now the banjo takes a break. Vamp behind it: chop on 2 and 4."
            startLabel="Start backing"
            autoStart
            onDone={(r2) => onDone(combine(r1!, r2))}
          />
        </>
      )}
    </section>
  );
}
