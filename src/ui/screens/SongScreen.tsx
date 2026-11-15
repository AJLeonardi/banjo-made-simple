import { useMemo, useState } from 'react';
import { ARRANGEMENT_LABELS, ARRANGEMENTS, ArrangementKind } from '../../music/arranger';
import { ARRANGEMENT_UNLOCK, TUNE_BY_ID, tuneTab } from '../../content/songs';
import { LESSON_BY_ID } from '../../content/lessons';
import { partTab } from '../../music/tab';
import { arrangementUnlocked, recordSong, songKey, tuneUnlocked, unlockHint } from '../../state/progress';
import { useStore } from '../../state/store';
import { Stars } from '../bits';
import { useMicScope } from '../EngineContext';
import { BackIcon, LockIcon, RepeatIcon } from '../Icons';
import type { Nav } from '../nav';
import { Player, PlayResult } from '../Player';
import { recordRun } from '../record';
import { Results } from '../Results';

const TEMPOS = [0.6, 0.8, 1] as const;

export function SongScreen({ id, go }: { id: string; go: Nav }) {
  useMicScope();
  const tune = TUNE_BY_ID[id];
  const { progress, update } = useStore();
  const firstOpen = ARRANGEMENTS.find((a) => arrangementUnlocked(progress, a)) ?? 'melody';
  const [arr, setArr] = useState<ArrangementKind>(firstOpen);
  const [part, setPart] = useState<string>('all');
  const [mode, setMode] = useState<'wait' | 'tempo'>('wait');
  const [tempo, setTempo] = useState<(typeof TEMPOS)[number]>(0.6);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [run, setRun] = useState(0);

  const tab = useMemo(() => (tune ? partTab(tuneTab(tune, arr), part) : null), [tune, arr, part]);

  if (!tune || !tuneUnlocked(progress, tune)) {
    return (
      <div className="page full">
        <div className="card stack">
          <h2>{tune ? tune.title : 'Tune not found'}</h2>
          {tune && <p className="muted">Locked — {unlockHint(tune)}.</p>}
          <button className="btn primary" onClick={() => go({ name: 'songs' })}>Back to songs</button>
        </div>
      </div>
    );
  }

  const arrOpen = arrangementUnlocked(progress, arr);
  const bpm = Math.round(tune.bpm * tempo);
  // Learn mode: up to 1 star. In time: 2 when slowed down, 3 at full speed. Parts score toward practice only.
  const cap = mode === 'wait' ? 1 : tempo < 1 ? 2 : 3;
  const counts = part === 'all';

  const done = (r: PlayResult) => {
    setResult(r);
    update((p) => {
      const q = recordRun(p, r);
      return counts ? recordSong(q, tune.id, arr, r.stars, r.accuracy) : q;
    });
  };

  const lockReason = (a: ArrangementKind) => {
    if (!LESSON_BY_ID['fretting'] || !progress.lessons['fretting']) return 'Finish "Fretting notes" in Learn';
    const need = ARRANGEMENT_UNLOCK[a];
    return need ? `Finish "${LESSON_BY_ID[need].title}" in Learn` : '';
  };

  return (
    <div className="page full">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go({ name: 'songs' })} aria-label="Back to songs">
          <BackIcon />
        </button>
        <div className="grow">
          <h1 className="display" style={{ fontSize: 24 }}>{tune.title}</h1>
          <div className="tiny muted">{tune.origin}</div>
        </div>
      </div>

      <div className="seg" role="group" aria-label="Arrangement">
        {ARRANGEMENTS.map((a) => (
          <button key={a} aria-pressed={arr === a} onClick={() => { setArr(a); setResult(null); }} title={arrangementUnlocked(progress, a) ? '' : lockReason(a)}>
            {!arrangementUnlocked(progress, a) && <LockIcon />}
            {ARRANGEMENT_LABELS[a]}
          </button>
        ))}
      </div>
      <div className="row between small">
        <span className="muted">Best: </span>
        <Stars n={progress.songs[songKey(tune.id, arr)]?.stars ?? 0} />
      </div>

      {!arrOpen ? (
        <div className="card stack">
          <div className="row"><LockIcon /> <b>{ARRANGEMENT_LABELS[arr]} is locked</b></div>
          <p className="muted">{lockReason(arr)} to play this arrangement.</p>
        </div>
      ) : (
        <>
          <div className="stack" style={{ gap: 8 }}>
            {tune.parts.length > 1 && (
              <div className="chips" role="group" aria-label="Part">
                {['all', ...tune.parts.map((p) => p.name)].map((p) => (
                  <button key={p} className="chip" aria-pressed={part === p} onClick={() => { setPart(p); setResult(null); }}>
                    {p === 'all' ? 'Whole tune' : `${p} part`}
                  </button>
                ))}
              </div>
            )}
            <div className="seg" role="group" aria-label="Mode">
              <button aria-pressed={mode === 'wait'} onClick={() => { setMode('wait'); setResult(null); }}>Learn</button>
              <button aria-pressed={mode === 'tempo'} onClick={() => { setMode('tempo'); setResult(null); }}>Play along</button>
            </div>
            {mode === 'tempo' && (
              <div className="chips" role="group" aria-label="Tempo">
                {TEMPOS.map((t) => (
                  <button key={t} className="chip" aria-pressed={tempo === t} onClick={() => { setTempo(t); setResult(null); }}>
                    {Math.round(t * 100)}% · {Math.round(tune.bpm * t)} bpm
                  </button>
                ))}
              </div>
            )}
            <p className="tiny muted">
              {mode === 'wait' ? 'Learn: the music waits for each note. ' : 'Play along in time with the band. '}
              Up to {cap} star{cap > 1 ? 's' : ''} {mode === 'wait' ? 'in Learn mode' : tempo < 1 ? 'when slowed down' : 'at full speed'}
              {counts ? '' : ' — play the whole tune to earn stars'}.
            </p>
          </div>

          {result ? (
            <Results r={result}>
              <button className="btn primary" onClick={() => { setResult(null); setRun((n) => n + 1); }}><RepeatIcon /> Play again</button>
            </Results>
          ) : (
            tab && <Player key={`${arr}:${part}:${mode}:${tempo}:${run}`} tab={tab} mode={mode} bpm={mode === 'wait' ? Math.round(tune.bpm * 0.6) : bpm} backing={mode === 'tempo'} starCap={cap} onDone={done} />
          )}
        </>
      )}
    </div>
  );
}
