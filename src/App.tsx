import { useCallback, useEffect, useState } from 'react';
import { AWARD_BY_ID } from './content/awards';
import { bump } from './state/progress';
import { StoreProvider, useStore } from './state/store';
import { Medal } from './ui/bits';
import { Calibrate } from './ui/Calibrate';
import { EngineProvider, useMicScope } from './ui/EngineContext';
import { BackIcon, MedalIcon, NoteIcon, PathIcon, UserIcon } from './ui/Icons';
import { fromHash, Nav, Route, TABS, toHash } from './ui/nav';
import { Awards } from './ui/screens/Awards';
import { Home } from './ui/screens/Home';
import { LessonScreen } from './ui/screens/LessonScreen';
import { Onboarding } from './ui/screens/Onboarding';
import { Profile } from './ui/screens/Profile';
import { Songs } from './ui/screens/Songs';
import { SongScreen } from './ui/screens/SongScreen';
import { Workout } from './ui/screens/Workout';
import { Tuner } from './ui/Tuner';

export function App() {
  return (
    <StoreProvider>
      <EngineProvider>
        <Shell />
      </EngineProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { settings } = useStore();
  const [route, setRoute] = useState<Route>(() => fromHash(location.hash));
  const [onboarding, setOnboarding] = useState(!settings.onboarded);

  const go: Nav = useCallback((r, replace = false) => {
    if (replace) history.replaceState(r, '', toHash(r));
    else history.pushState(r, '', toHash(r));
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(fromHash(location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (onboarding) return <Onboarding onDone={() => { setOnboarding(false); go({ name: 'learn' }, true); }} />;

  const isTab = TABS.includes(route.name);
  return (
    <div className="app">
      <Toasts />
      <main>
        {route.name === 'learn' && <Home go={go} />}
        {route.name === 'songs' && <Songs go={go} />}
        {route.name === 'awards' && <Awards />}
        {route.name === 'me' && <Profile go={go} />}
        {route.name === 'lesson' && <LessonScreen key={route.id} id={route.id} go={go} />}
        {route.name === 'song' && <SongScreen key={route.id} id={route.id} go={go} />}
        {route.name === 'workout' && <Workout go={go} />}
        {route.name === 'tuner' && <TunerPage go={go} />}
        {route.name === 'calibrate' && <CalibratePage go={go} />}
      </main>
      {isTab && (
        <nav className="nav" aria-label="Main">
          <div className="nav-inner">
            {([
              ['learn', 'Learn', <PathIcon key="i" />],
              ['songs', 'Songs', <NoteIcon key="i" />],
              ['awards', 'Awards', <MedalIcon key="i" />],
              ['me', 'Me', <UserIcon key="i" />],
            ] as const).map(([name, label, icon]) => (
              <button key={name} aria-current={route.name === name ? 'page' : undefined} onClick={() => go({ name } as Route)}>
                {icon}
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function TunerPage({ go }: { go: Nav }) {
  useMicScope();
  const { update } = useStore();
  return (
    <div className="page full">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go({ name: 'me' })} aria-label="Back"><BackIcon /></button>
        <h1 className="display">Tuner</h1>
      </div>
      <p className="muted">Open G tuning, 5th to 1st string: g D G B D.</p>
      <Tuner onTuned={() => update((p) => bump(p, 'tuner'))} />
    </div>
  );
}

function CalibratePage({ go }: { go: Nav }) {
  useMicScope();
  return (
    <div className="page full">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go({ name: 'me' })} aria-label="Back"><BackIcon /></button>
        <h1 className="display">Timing</h1>
      </div>
      <Calibrate />
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useStore();
  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => dismissToast(toasts[0]), 4500);
    return () => clearTimeout(t);
  }, [toasts, dismissToast]);
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.slice(0, 2).map((id) => {
        const a = AWARD_BY_ID[id];
        return (
          <button key={id} className="toast" onClick={() => dismissToast(id)}>
            <Medal award={a} />
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="tiny muted">Award earned</span>
              <br />
              <b>{a.title}</b> <span className="small muted">— {a.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
