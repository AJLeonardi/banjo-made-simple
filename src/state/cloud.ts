// Google sign-in + progress sync through Firebase (Auth + Firestore). Optional: without
// the VITE_FIREBASE_* variables the app runs in guest mode, saving on this device only.
// The Firebase SDK is loaded lazily, so guest mode doesn't download it.

import type { Progress } from './progress';

export interface CloudUser {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = !!(config.apiKey && config.authDomain && config.projectId && config.appId);

type Fb = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  authMod: typeof import('firebase/auth');
  fsMod: typeof import('firebase/firestore');
};

let fb: Promise<Fb> | null = null;

function load(): Promise<Fb> {
  if (!cloudEnabled) return Promise.reject(new Error('Sign-in is not configured'));
  fb ??= (async () => {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const app = initializeApp(config as Required<typeof config>);
    const auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    const db = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache() });
    return { auth, db, authMod, fsMod };
  })();
  return fb;
}

const toUser = (u: import('firebase/auth').User): CloudUser => ({ uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL });

/** Subscribe to sign-in state. Also completes a redirect sign-in after the page reloads. */
export function watchUser(cb: (u: CloudUser | null) => void): () => void {
  if (!cloudEnabled) {
    cb(null);
    return () => {};
  }
  let off = () => {};
  let cancelled = false;
  load()
    .then(({ auth, authMod }) => {
      if (cancelled) return;
      authMod.getRedirectResult(auth).catch(() => {});
      off = authMod.onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    })
    .catch(() => cb(null));
  return () => {
    cancelled = true;
    off();
  };
}

export async function signInWithGoogle(): Promise<void> {
  const { auth, authMod } = await load();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await authMod.signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    // Popups are often blocked on phones and in installed (standalone) apps: fall back.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/cancelled-popup-request') {
      await authMod.signInWithRedirect(auth, provider);
      return;
    }
    if (code === 'auth/popup-closed-by-user') return;
    throw e;
  }
}

export async function signOutCloud(): Promise<void> {
  const { auth, authMod } = await load();
  await authMod.signOut(auth);
}

export async function loadCloudProgress(uid: string): Promise<Progress | null> {
  const { db, fsMod } = await load();
  const snap = await fsMod.getDoc(fsMod.doc(db, 'users', uid));
  return snap.exists() ? ((snap.data().progress as Progress) ?? null) : null;
}

export async function saveCloudProgress(uid: string, p: Progress): Promise<void> {
  const { db, fsMod } = await load();
  await fsMod.setDoc(fsMod.doc(db, 'users', uid), { progress: p, updatedAt: fsMod.serverTimestamp() }, { merge: true });
}
