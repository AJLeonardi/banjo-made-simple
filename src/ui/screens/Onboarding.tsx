import { useState } from 'react';
import { LESSON_BY_ID, PLACEMENT } from '../../content/lessons';
import type { Placement } from '../../state/progress';
import { useStore } from '../../state/store';
import { BanjoMark, GoogleG, HeadphonesIcon, NoteIcon, PathIcon, SpeakerIcon, StarIcon } from '../Icons';

const LEVELS: { id: Placement; title: string; text: string }[] = [
  { id: 'new', title: "I'm brand new", text: 'Start from the very beginning: holding the banjo, tuning, first notes.' },
  { id: 'some', title: 'I know a little', text: 'I can pick the strings with thumb, index and middle. Start at rolls.' },
  { id: 'rolls', title: 'I can play rolls', text: 'I know my forward roll. Start with the left hand and chords.' },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { update, setSettings, settings, cloudEnabled, user, signIn } = useStore();
  const [page, setPage] = useState(0);
  const [level, setLevel] = useState<Placement>('new');

  const finish = () => {
    update((p) => ({ ...p, placement: level, updatedAt: Date.now() }));
    setSettings({ onboarded: true });
    onDone();
  };

  return (
    <div className="page full" style={{ justifyContent: 'center' }}>
      {page === 0 && (
        <section className="stack center" style={{ alignItems: 'center' }}>
          <div style={{ width: 96, height: 96 }}><BanjoMark /></div>
          <h1 className="display" style={{ fontSize: 34 }}>Banjo Made Simple</h1>
          <p className="muted" style={{ maxWidth: 420 }}>Learn 5-string banjo step by step. Play your real banjo — the app listens, tells you if you're right, and shows you where your fingers go.</p>
          <div className="stack" style={{ textAlign: 'left', maxWidth: 420 }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}><PathIcon /> <span>A path from your first note to rolls, backup and real tunes</span></div>
            <div className="row" style={{ flexWrap: 'nowrap' }}><NoteIcon /> <span>25 bluegrass and old-time tunes to earn</span></div>
            <div className="row" style={{ flexWrap: 'nowrap' }}><StarIcon /> <span>Stars, streaks and awards as you go</span></div>
          </div>
          <button className="btn primary block" style={{ maxWidth: 420 }} onClick={() => setPage(1)}>Get started</button>
        </section>
      )}
      {page === 1 && (
        <section className="stack">
          <h1 className="display">Have you played banjo before?</h1>
          {LEVELS.map((l) => (
            <button key={l.id} className="card choice" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
              <div className="grow">
                <b>{l.title}</b>
                <div className="small muted">{l.text}</div>
              </div>
            </button>
          ))}
          <p className="tiny muted">You can always go back to earlier lessons. You'll start at "{LESSON_BY_ID[PLACEMENT[level]].title}".</p>
          <button className="btn primary block" onClick={() => setPage(2)}>Next</button>
        </section>
      )}
      {page === 2 && (
        <section className="stack">
          <h1 className="display">How will you hear the app?</h1>
          <button className="card choice" aria-pressed={settings.backing === 'headphones'} onClick={() => setSettings({ backing: 'headphones' })}>
            <HeadphonesIcon />
            <div className="grow"><b>Headphones</b><div className="small muted">Best: you get the full band, and the mic hears only your banjo.</div></div>
          </button>
          <button className="card choice" aria-pressed={settings.backing === 'speaker'} onClick={() => setSettings({ backing: 'speaker' })}>
            <SpeakerIcon />
            <div className="grow"><b>Phone or laptop speaker</b><div className="small muted">Works too: the band plays lighter so the mic can hear you.</div></div>
          </button>
          <button className="btn primary block" onClick={() => setPage(cloudEnabled && !user ? 3 : 4)}>Next</button>
        </section>
      )}
      {page === 3 && (
        <section className="stack">
          <h1 className="display">Save your progress</h1>
          <p className="muted">Sign in with Google to keep your stars, songs and streak on every device.</p>
          <button className="btn block" onClick={() => void signIn().then(finish).catch(() => {})}>
            <GoogleG /> Sign in with Google
          </button>
          <button className="btn ghost block" onClick={finish}>Not now — continue as a guest</button>
        </section>
      )}
      {page === 4 && (
        <section className="stack">
          <h1 className="display">You're all set</h1>
          <p className="muted">Grab your banjo. The first lesson will ask to use your microphone — that's how the app hears you play. Nothing you play leaves your device.</p>
          <button className="btn primary block" onClick={finish}>Let's play</button>
        </section>
      )}
    </div>
  );
}
