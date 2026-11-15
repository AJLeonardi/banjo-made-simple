// One microphone engine for the app. It's started from a tap (iOS only allows audio to
// start from a user gesture) and released when the listening screen closes.

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { useStore } from '../state/store';

interface EngineState {
  engine: AudioEngine | null;
  error: string | null;
  /** Start listening (call from a click/tap). Resolves to the engine, or null on failure. */
  start: () => Promise<AudioEngine | null>;
  stop: () => void;
}

const Ctx = createContext<EngineState | null>(null);

function explain(e: unknown): string {
  const name = (e as { name?: string }).name ?? '';
  if (!window.isSecureContext) return 'The microphone only works over https. Open the app from its https address.';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found. Plug one in or check your device settings.';
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.';
  return 'Could not start the microphone. Try again, or reload the page.';
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const { settings } = useStore();
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<AudioEngine | null>(null);
  const pending = useRef<Promise<AudioEngine | null> | null>(null);

  const start = useCallback(async () => {
    if (ref.current) return ref.current;
    if (pending.current) return pending.current;
    setError(null);
    pending.current = (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no mediaDevices'), { name: window.isSecureContext ? 'NotFoundError' : 'SecurityError' });
        const e = await AudioEngine.start(settings.sensitivity);
        ref.current = e;
        setEngine(e);
        return e;
      } catch (err) {
        setError(explain(err));
        return null;
      } finally {
        pending.current = null;
      }
    })();
    return pending.current;
  }, [settings.sensitivity]);

  const stop = useCallback(() => {
    ref.current?.stop();
    ref.current = null;
    setEngine(null);
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.sensitivity = settings.sensitivity;
  }, [settings.sensitivity]);

  return <Ctx.Provider value={{ engine, error, start, stop }}>{children}</Ctx.Provider>;
}

export function useEngine(): EngineState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEngine outside EngineProvider');
  return c;
}

/** Release the mic when the calling screen unmounts. */
export function useMicScope() {
  const { stop } = useEngine();
  useEffect(() => () => stop(), [stop]);
}
