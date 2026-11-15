import { COURSES, LESSON_BY_ID } from '../../content/lessons';
import { lessonDone, lessonUnlocked, nextLesson, streak, todaySeconds, totalStars } from '../../state/progress';
import { useStore } from '../../state/store';
import { Ring, Stars } from '../bits';
import { BanjoMark, CheckIcon, FlameIcon, LockIcon, NoteIcon, PlayIcon, StarIcon, SunIcon } from '../Icons';
import type { Nav } from '../nav';

export function Home({ go }: { go: Nav }) {
  const { progress } = useStore();
  const next = nextLesson(progress);
  const nextL = next ? LESSON_BY_ID[next] : null;
  const days = streak(progress);
  const goal = progress.dailyGoalMin * 60;
  const today = todaySeconds(progress);
  const workoutReady = Object.keys(progress.lessons).length >= 2;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand grow">
          <BanjoMark />
          <span className="display">Banjo Made Simple</span>
        </div>
        <span className="pill flame" title="Day streak" aria-label={`${days} day streak`}>
          <FlameIcon /> {days}
        </span>
        <span className="pill star" title="Stars" aria-label={`${totalStars(progress)} stars`}>
          <StarIcon /> {totalStars(progress)}
        </span>
      </header>

      {nextL ? (
        <section className="card wood stack">
          <div className="row">
            <div className="grow stack" style={{ gap: 4 }}>
              <span className="small muted">{Object.keys(progress.lessons).length ? 'Up next' : 'Start here'}</span>
              <h2 className="display" style={{ fontSize: 26 }}>{nextL.title}</h2>
              <p className="small muted">{nextL.summary}</p>
            </div>
            <Ring value={today / goal} label={<>{Math.floor(today / 60)}<br />/{progress.dailyGoalMin}m</>} size={64} />
          </div>
          <button className="btn primary block" onClick={() => go({ name: 'lesson', id: nextL.id })}>
            <PlayIcon /> {Object.keys(progress.lessons).length ? 'Continue' : 'Start your first lesson'}
          </button>
        </section>
      ) : (
        <section className="card wood stack">
          <h2 className="display">You've finished the path!</h2>
          <p className="muted">Keep your streak going with tunes from the library.</p>
          <button className="btn primary" onClick={() => go({ name: 'songs' })}>
            <NoteIcon /> Open the song library
          </button>
        </section>
      )}

      {workoutReady && (
        <button className="card row" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => go({ name: 'workout' })}>
          <SunIcon />
          <div className="grow">
            <b>Daily Workout</b>
            <div className="small muted">Three quick drills from what you've learned — about 5 minutes.</div>
          </div>
          <PlayIcon />
        </button>
      )}

      {COURSES.map((c) => {
        const doneCount = c.lessons.filter((l) => lessonDone(progress, l.id)).length;
        return (
          <section key={c.id} className="course">
            <div className="course-head">
              <div className="row between">
                <h2 className="display">{c.title}</h2>
                <span className="small muted">
                  {doneCount}/{c.lessons.length}
                </span>
              </div>
              <p className="small muted">{c.subtitle}</p>
            </div>
            <div className="path">
              {c.lessons.map((l) => {
                const done = lessonDone(progress, l.id);
                const open = lessonUnlocked(progress, l.id);
                const current = l.id === next;
                return (
                  <button
                    key={l.id}
                    className={`lesson-node${done ? ' done' : ''}${current ? ' current' : ''}${!open ? ' locked' : ''}`}
                    onClick={() => open && go({ name: 'lesson', id: l.id })}
                    aria-disabled={!open}
                    aria-label={`${l.title}${done ? ', done' : !open ? ', locked' : ''}`}
                  >
                    <span className="node-disc">{done ? <CheckIcon /> : open ? <PlayIcon /> : <LockIcon />}</span>
                    <span className="stack" style={{ gap: 2 }}>
                      <span className="title">{l.title}</span>
                      {done ? <Stars n={progress.lessons[l.id].stars} /> : <span className="small muted">{l.summary}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
