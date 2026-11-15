// App-wide state: progress (local + cloud), settings, signed-in user, award toasts.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateAwards } from '../content/awards';
import { DEFAULT_SETTINGS, loadSettings, Settings, saveSettings } from '../settings';
import { load, save } from '../storage';
import { cloudEnabled, CloudUser, loadCloudProgress, saveCloudProgress, signInWithGoogle, signOutCloud, watchUser } from './cloud';
import { emptyProgress, mergeProgress, normalize, Progress } from './progress';

const GUEST = 'bms.progress.guest';
const userKey = (uid: string) => `bms.progress.${uid}`;
const readLocal = (key: string) => normalize(load<Partial<Progress> | null>(key, null as never));

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline';

interface Store {
  progress: Progress;
  /** Apply a change to progress (pure function). Awards are checked automatically. */
  update: (fn: (p: Progress) => Progress) => void;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  user: CloudUser | null;
  /** True until the first auth state is known. */
  authLoading: boolean;
  cloudEnabled: boolean;
  sync: SyncState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Awards earned and not yet shown. */
  toasts: string[];
  dismissToast: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...loadSettings() }));
  const [user, setUser] = useState<CloudUser | null>(null);
  const [authLoading, setAuthLoading] = useState(cloudEnabled);
  const [progress, setProgressState] = useState<Progress>(() => readLocal(GUEST));
  // The latest progress, updated synchronously so back-to-back updates compose.
  const progressRef = useRef(progress);
  const setProgress = useCallback((p: Progress) => {
    progressRef.current = p;
    setProgressState(p);
  }, []);
  const [sync, setSync] = useState<SyncState>('local');
  const [toasts, setToasts] = useState<string[]>([]);
  const keyRef = useRef(GUEST);
  const uidRef = useRef<string | null>(null);
  const saveTimer = useRef(0);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const n = { ...s, ...patch };
      saveSettings(n);
      return n;
    });
  }, []);

  const pushCloud = useCallback((p: Progress) => {
    const uid = uidRef.current;
    if (!uid) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSync('syncing');
      saveCloudProgress(uid, p)
        .then(() => setSync('synced'))
        .catch(() => setSync('offline'));
    }, 1500);
  }, []);

  const update = useCallback(
    (fn: (p: Progress) => Progress) => {
      const prev = progressRef.current;
      const changed = fn(prev);
      if (changed === prev) return;
      const { progress: next, earned } = evaluateAwards(changed);
      setProgress(next);
      if (earned.length) setToasts((t) => [...t, ...earned.filter((e) => !t.includes(e))]);
      save(keyRef.current, next);
      pushCloud(next);
    },
    [pushCloud, setProgress],
  );

  // Sign-in state: switch to the user's progress, merging in anything played as a guest.
  useEffect(
    () =>
      watchUser(async (u) => {
        setUser(u);
        setAuthLoading(false);
        if (!u) {
          uidRef.current = null;
          keyRef.current = GUEST;
          setProgress(readLocal(GUEST));
          setSync('local');
          return;
        }
        uidRef.current = u.uid;
        keyRef.current = userKey(u.uid);
        const guest = readLocal(GUEST);
        let merged = mergeProgress(readLocal(userKey(u.uid)), guest);
        setProgress(merged);
        setSync('syncing');
        try {
          const cloud = await loadCloudProgress(u.uid);
          if (cloud) merged = mergeProgress(merged, normalize(cloud));
          save(userKey(u.uid), merged);
          save(GUEST, emptyProgress()); // the guest's progress now lives with the account
          setProgress(merged);
          await saveCloudProgress(u.uid, merged);
          setSync('synced');
        } catch {
          setSync('offline');
        }
      }),
    [setProgress],
  );

  const signIn = useCallback(() => signInWithGoogle(), []);
  const signOut = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (uidRef.current) await saveCloudProgress(uidRef.current, progressRef.current).catch(() => {});
    await signOutCloud();
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x !== id)), []);

  const value = useMemo<Store>(
    () => ({ progress, update, settings, setSettings, user, authLoading, cloudEnabled, sync, signIn, signOut, toasts, dismissToast }),
    [progress, update, settings, setSettings, user, authLoading, sync, signIn, signOut, toasts, dismissToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
