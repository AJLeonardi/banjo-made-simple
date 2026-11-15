import { useState } from 'react';
import { ARRANGEMENTS } from '../../music/arranger';
import { TUNES } from '../../content/songs';
import { songKey, totalStars, tuneUnlocked, unlockHint } from '../../state/progress';
import { useStore } from '../../state/store';
import { Stars } from '../bits';
import { LockIcon, NoteIcon, StarIcon } from '../Icons';
import type { Nav } from '../nav';

export function Songs({ go }: { go: Nav }) {
  const { progress } = useStore();
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const list = TUNES.map((t) => ({ t, open: tuneUnlocked(progress, t) })).filter((x) => filter === 'all' || x.open);
  const openCount = TUNES.filter((t) => tuneUnlocked(progress, t)).length;

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="display grow">Songs</h1>
        <span className="pill star"><StarIcon /> {totalStars(progress)}</span>
      </header>
      <p className="muted">
        {openCount} of {TUNES.length} tunes unlocked. Earn more by finishing lessons and collecting stars. Every tune has a Melody, a Scruggs-roll and a Backup arrangement.
      </p>
      <div className="chips" role="group" aria-label="Filter">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All tunes</button>
        <button className="chip" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Unlocked</button>
      </div>
      <div className="stack">
        {list.map(({ t, open }) => {
          const best = Math.max(0, ...ARRANGEMENTS.map((a) => progress.songs[songKey(t.id, a)]?.stars ?? 0));
          return (
            <button key={t.id} className={`card song-card${open ? '' : ' locked'}`} onClick={() => open && go({ name: 'song', id: t.id })} aria-disabled={!open}>
              <span className="song-art">{open ? <NoteIcon /> : <LockIcon />}</span>
              <span className="grow stack" style={{ gap: 2 }}>
                <span className="title">{t.title}</span>
                <span className="small muted">{open ? t.blurb : unlockHint(t)}</span>
                <span className="row small muted" style={{ gap: 8 }}>
                  <span className="level" aria-label={`Level ${t.level} of 3`}>
                    {[1, 2, 3].map((k) => <i key={k} className={k <= t.level ? 'on' : ''} />)}
                  </span>
                  {t.meter === 3 ? 'Waltz' : `${t.parts.length > 1 ? 'A & B parts' : 'One part'}`}
                </span>
              </span>
              {open && <Stars n={best} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
