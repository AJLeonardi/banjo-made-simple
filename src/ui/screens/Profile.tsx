import { AWARDS } from '../../content/awards';
import { ALL_LESSONS } from '../../content/lessons';
import { dayKey, streak, totalStars } from '../../state/progress';
import { useStore } from '../../state/store';
import { GoogleG, HeadphonesIcon, MicIcon, SpeakerIcon, TunerIcon, UserIcon } from '../Icons';
import type { Nav } from '../nav';

export function Profile({ go }: { go: Nav }) {
  const { progress, update, settings, setSettings, user, cloudEnabled, sync, signIn, signOut, authLoading } = useStore();
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - k);
    return progress.days[dayKey(d)] ?? 0;
  }).reduce((a, b) => a + b, 0);
  const syncLabel = { local: 'Saved on this device', syncing: 'Saving…', synced: 'Saved to your account', offline: 'Offline — will save when you reconnect' }[sync];

  return (
    <div className="page">
      <h1 className="display">Me</h1>

      <section className="card stack">
        <div className="row">
          <div className="avatar">{user?.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : <UserIcon />}</div>
          <div className="grow">
            <b>{user ? user.name ?? user.email : 'Guest'}</b>
            <div className="small muted">{user ? user.email : 'Progress is saved on this device only.'}</div>
            <div className="tiny muted">{syncLabel}</div>
          </div>
        </div>
        {cloudEnabled ? (
          user ? (
            <button className="btn" onClick={() => void signOut()}>Sign out</button>
          ) : (
            <button className="btn" disabled={authLoading} onClick={() => void signIn().catch(() => alert('Sign-in failed. Please try again.'))}>
              <GoogleG /> Sign in with Google to save your progress
            </button>
          )
        ) : (
          <p className="tiny muted">Google sign-in isn't set up on this server yet (see the README), so progress stays on this device.</p>
        )}
      </section>

      <section className="statgrid">
        <div className="card flat center"><b>{streak(progress)}</b><span className="small">day streak</span></div>
        <div className="card flat center"><b>{totalStars(progress)}</b><span className="small">stars</span></div>
        <div className="card flat center"><b>{Math.round(week / 60)}</b><span className="small">min this week</span></div>
        <div className="card flat center"><b>{Object.keys(progress.lessons).length}/{ALL_LESSONS.length}</b><span className="small">lessons</span></div>
        <div className="card flat center"><b>{progress.counters.notes}</b><span className="small">notes played</span></div>
        <div className="card flat center"><b>{Object.keys(progress.awards).length}/{AWARDS.length}</b><span className="small">awards</span></div>
      </section>

      <section className="card stack">
        <h2>Daily goal</h2>
        <div className="chips" role="group" aria-label="Daily goal">
          {[5, 10, 15, 20, 30].map((m) => (
            <button key={m} className="chip" aria-pressed={progress.dailyGoalMin === m} onClick={() => update((p) => ({ ...p, dailyGoalMin: m, updatedAt: Date.now() }))}>
              {m} min
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Listening</h2>
        <div className="field">
          <label>How do you hear the app?</label>
          <div className="seg" role="group" aria-label="Backing">
            <button aria-pressed={settings.backing === 'headphones'} onClick={() => setSettings({ backing: 'headphones' })}><HeadphonesIcon /> Headphones</button>
            <button aria-pressed={settings.backing === 'speaker'} onClick={() => setSettings({ backing: 'speaker' })}><SpeakerIcon /> Speaker</button>
          </div>
          <p className="tiny muted">
            Headphones: the full band (bass and guitar). Speaker: a lighter band that stays out of the way of the microphone, so it isn't mistaken for your playing.
          </p>
        </div>
        <div className="field">
          <label htmlFor="sens">Mic sensitivity</label>
          <input id="sens" type="range" min="0.2" max="0.95" step="0.05" value={settings.sensitivity} onChange={(e) => setSettings({ sensitivity: Number(e.target.value) })} />
          <p className="tiny muted">Turn it down in a noisy room; up if quiet notes are missed.</p>
        </div>
        <div className="field">
          <label htmlFor="vol">Band volume</label>
          <input id="vol" type="range" min="0.2" max="1" step="0.05" value={settings.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} />
        </div>
        <div className="row">
          <button className="btn" onClick={() => go({ name: 'tuner' })}><TunerIcon /> Tuner</button>
          <button className="btn" onClick={() => go({ name: 'calibrate' })}><MicIcon /> Timing calibration</button>
        </div>
        <label className="row small">
          <input type="checkbox" checked={settings.voice} onChange={(e) => setSettings({ voice: e.target.checked })} /> Voice narration in lessons
        </label>
        <label className="row small">
          <input type="checkbox" checked={settings.debug} onChange={(e) => setSettings({ debug: e.target.checked })} /> Show what the detectors hear (debug)
        </label>
      </section>

      <p className="tiny muted center">Banjo Made Simple {__APP_VERSION__}. Everything you play is analysed on this device; no audio is uploaded. Narration voice: Kokoro-82M (Apache 2.0).</p>
    </div>
  );
}
