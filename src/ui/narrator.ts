// Plays the pre-generated narration clip for a lesson step. One clip at a time; it stops
// when a new one starts, when the player starts listening, or when the screen closes.

import { useCallback, useEffect, useState } from 'react';
import { narrationId } from '../content/narration';

let current: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const clipUrl = (text: string) => `${import.meta.env.BASE_URL}voice/${narrationId(text)}.mp3`;

export function stopNarration() {
  if (current) {
    current.pause();
    current = null;
    notify();
  }
}

/** Play a clip. Resolves false if the browser blocked it (no tap yet) or it's missing. */
export async function playNarration(text: string, volume = 1): Promise<boolean> {
  stopNarration();
  const a = new Audio(clipUrl(text));
  a.volume = volume;
  current = a;
  a.onplaying = a.onpause = notify;
  a.onended = a.onerror = () => {
    if (current === a) {
      current = null;
      notify();
    }
  };
  notify();
  try {
    await a.play();
    return true;
  } catch {
    if (current === a) current = null;
    notify();
    return false;
  }
}

/**
 * Narrate `text` when it changes (if enabled). Returns whether it's playing, and controls.
 * `blocked` = autoplay was refused (e.g. the page was opened directly); a tap on replay works.
 */
export function useNarration(text: string | null, enabled: boolean, volume = 1) {
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const l = () => setPlaying(!!current && !current.paused);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    setBlocked(false);
    if (!text || !enabled) {
      stopNarration();
      return;
    }
    let live = true;
    playNarration(text, volume).then((ok) => live && setBlocked(!ok));
    return () => {
      live = false;
      stopNarration();
    };
  }, [text, enabled, volume]);

  const replay = useCallback(() => {
    if (!text) return;
    setBlocked(false);
    void playNarration(text, volume);
  }, [text, volume]);

  return { playing, blocked, replay, stop: stopNarration };
}
