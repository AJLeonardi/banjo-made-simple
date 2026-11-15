import { useMemo, useState } from 'react';
import { ALL_LESSONS, isTab, Step } from '../../content/lessons';
import { TUNE_BY_ID } from '../../content/songs';
import { bump, dayKey } from '../../state/progress';
import { useStore } from '../../state/store';
import { Stars } from '../bits';
import { useMicScope } from '../EngineContext';
import { CloseIcon } from '../Icons';
import type { Nav } from '../nav';
import { Player, PlayResult } from '../Player';
import { recordRun } from '../record';
import { resolveTab } from './LessonScreen';

type PlayStep = Extract<Step, { kind: 'play' }>;

/** Three drills from completed lessons, the same set all day. */
function pickDrills(done: Set<string>, today: string): { lesson: string; step: PlayStep }[] {
  const pool = ALL_LESSONS.filter((l) => done.has(l.id)).flatMap((l) => l.steps.filter((s): s is PlayStep => s.kind === 'play').map((step) => ({ lesson: l.title, step })));
  let seed = [...today].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out: typeof pool = [];
  const copy = [...pool];
  while (out.length < 3 && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

export function Workout({ go }: { go: Nav }) {
  useMicScope();
  const { progress, update } = useStore();
  const drills = useMemo(() => pickDrills(new Set(Object.keys(progress.lessons)), dayKey(new Date())), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [stars, setStars] = useState<number[]>([]);

  const done = (r: PlayResult) => {
    const next = [...stars, r.stars];
    setStars(next);
    update((p) => {
      const q = recordRun(p, r);
      return next.length === drills.length ? bump(q, 'workouts') : q;
    });
    setI(i + 1);
  };

  if (!drills.length)
    return (
      <div className="page full">
        <div className="card stack">
          <h2>Finish a couple of lessons first</h2>
          <button className="btn primary" onClick={() => go({ name: 'learn' })}>Back</button>
        </div>
      </div>
    );

  const d = drills[i];
  return (
    <div className="page full">
      <div className="runner-top">
        <button className="iconbtn" onClick={() => go({ name: 'learn' })} aria-label="Close workout"><CloseIcon /></button>
        <div className="steps">{drills.map((_, k) => <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />)}</div>
      </div>
      {d ? (
        <section className="stack">
          <h2 className="step-title display">Drill {i + 1}: {d.step.title}</h2>
          <p className="small muted">From "{d.lesson}"</p>
          <Player
            key={i}
            tab={resolveTab(d.step.source)}
            mode={d.step.mode}
            bpm={d.step.bpm ?? (!isTab(d.step.source) ? Math.round(TUNE_BY_ID[d.step.source.tune].bpm * 0.7) : 70)}
            backing={d.step.backing}
            prompt={d.step.prompt}
            onDone={done}
          />
        </section>
      ) : (
        <div className="card stack center" style={{ alignItems: 'center' }}>
          <h1 className="display">Workout done!</h1>
          <div className="row">{stars.map((s, k) => <Stars key={k} n={s} />)}</div>
          <p className="muted">See you tomorrow — keep that streak going.</p>
          <button className="btn primary" onClick={() => go({ name: 'learn' })}>Back to the path</button>
        </div>
      )}
    </div>
  );
}
