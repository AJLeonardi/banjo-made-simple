// Per-device settings (not synced: they depend on this phone/mic/headphones).
import type { BackingMode } from './audio/band';
import { load, save } from './storage';

export interface Settings {
  /** How the player hears the app: decides what the backing band may play. */
  backing: BackingMode;
  /** Mic sensitivity 0..1. */
  sensitivity: number;
  /** Measured delay from a click to the mic hearing a strum on it (ms). */
  latencyMs: number;
  volume: number;
  /** Show the debug readout (what the detectors hear). */
  debug: boolean;
  /** Spoken narration in lessons. */
  voice: boolean;
  /** Finished the first-run onboarding on this device. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backing: 'speaker',
  sensitivity: 0.6,
  latencyMs: 0,
  volume: 0.8,
  debug: false,
  voice: true,
  onboarded: false,
};

const KEY = 'bms.settings.v1';
export const loadSettings = () => load<Settings>(KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => save(KEY, s);
