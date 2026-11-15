// Player progress: pure data + pure functions (unit tested). Saved to localStorage and,
// when signed in, to Firestore; mergeProgress() combines the two so nothing is lost.

import { ArrangementKind } from '../music/arranger';
import { ALL_LESSONS, PLACEMENT } from '../content/lessons';
import { ARRANGEMENT_UNLOCK, Tune } from '../content/songs';

export type Placement = keyof typeof PLACEMENT;

export interface SongRecord {
  stars: number;
  accuracy: number;
  plays: number;
  at: number;
}

export interface Progress {
  v: 1;
  /** Completed lessons: best stars. */
  lessons: Record<string, { stars: number; at: number }>;
  /** Best stars per lesson step, key `${lessonId}#${index}`. */
  steps: Record<string, number>;
  /** Best result per tune arrangement, key `${tuneId}:${arrangement}`. */
  songs: Record<string, SongRecord>;
  /** Seconds of playing per local day, key YYYY-MM-DD. */
  days: Record<string, number>;
  /** Award id → when earned (ms). */
  awards: Record<string, number>;
  counters: { notes: number; chops: number; trades: number; workouts: number; tuner: number; perfect: number };
  placement: Placement | null;
  dailyGoalMin: number;
  updatedAt: number;
}

export function emptyProgress(): Progress {
  return {
    v: 1,
    lessons: {},
    steps: {},
    songs: {},
    days: {},
    awards: {},
    counters: { notes: 0, chops: 0, trades: 0, workouts: 0, tuner: 0, perfect: 0 },
    placement: null,
    dailyGoalMin: 10,
    updatedAt: 0,
  };
}

/** Fill in anything missing (older saves, partial cloud docs). */
export function normalize(p: Partial<Progress> | null | undefined): Progress {
  const e = emptyProgress();
  if (!p || typeof p !== 'object') return e;
  return {
    ...e,
    ...p,
    lessons: { ...(p.lessons ?? {}) },
    steps: { ...(p.steps ?? {}) },
    songs: { ...(p.songs ?? {}) },
    days: { ...(p.days ?? {}) },
    awards: { ...(p.awards ?? {}) },
    counters: { ...e.counters, ...(p.counters ?? {}) },
    v: 1,
  };
}

// ---------------------------------------------------------------------------------------
// Stars

export const STAR_THRESHOLDS = [0.6, 0.8, 0.95];

/** 0–3 stars from accuracy, capped (wait mode: 1, slowed tempo: 2, full tempo: 3). */
export function starsFor(accuracy: number, cap = 3): number {
  const s = STAR_THRESHOLDS.filter((t) => accuracy >= t).length;
  return Math.min(s, cap);
}

export const songKey = (tuneId: string, arr: ArrangementKind) => `${tuneId}:${arr}`;

export function totalStars(p: Progress): number {
  let n = 0;
  for (const l of Object.values(p.lessons)) n += l.stars;
  for (const s of Object.values(p.songs)) n += s.stars;
  return n;
}

// ---------------------------------------------------------------------------------------
// Unlocks

const LESSON_INDEX = new Map(ALL_LESSONS.map((l, i) => [l.id, i]));

export function lessonDone(p: Progress, id: string): boolean {
  return !!p.lessons[id];
}

/** A lesson is open if it's at/before the placement start, done, or the previous one is done. */
export function lessonUnlocked(p: Progress, id: string): boolean {
  const i = LESSON_INDEX.get(id);
  if (i === undefined) return false;
  if (lessonDone(p, id)) return true;
  const start = LESSON_INDEX.get(PLACEMENT[p.placement ?? 'new']) ?? 0;
  if (i <= start) return true;
  return lessonDone(p, ALL_LESSONS[i - 1].id);
}

/** The lesson to continue with: first unlocked, not-yet-done lesson. */
export function nextLesson(p: Progress): string | null {
  for (const l of ALL_LESSONS) if (lessonUnlocked(p, l.id) && !lessonDone(p, l.id)) return l.id;
  return null;
}

export function tuneUnlocked(p: Progress, t: Tune): boolean {
  if ('lesson' in t.unlock) return lessonDone(p, t.unlock.lesson);
  return totalStars(p) >= t.unlock.stars;
}

/** Tunes need the left hand: none are playable before the fretting lesson. */
export function arrangementUnlocked(p: Progress, kind: ArrangementKind): boolean {
  const need = ARRANGEMENT_UNLOCK[kind];
  return lessonDone(p, 'fretting') && (!need || lessonDone(p, need));
}

/** Human-readable unlock requirement. */
export function unlockHint(t: Tune): string {
  if ('lesson' in t.unlock) {
    const l = ALL_LESSONS.find((x) => x.id === (t.unlock as { lesson: string }).lesson);
    return `Finish the lesson "${l?.title ?? t.unlock.lesson}"`;
  }
  return `Earn ${t.unlock.stars} stars`;
}

// ---------------------------------------------------------------------------------------
// Recording results (all return a new Progress)

const touch = (p: Progress, now: number): Progress => ({ ...p, updatedAt: now });

export function recordStep(p: Progress, lessonId: string, index: number, stars: number, now = Date.now()): Progress {
  const key = `${lessonId}#${index}`;
  if ((p.steps[key] ?? -1) >= stars) return p;
  return touch({ ...p, steps: { ...p.steps, [key]: stars } }, now);
}

export function completeLesson(p: Progress, lessonId: string, stars: number, now = Date.now()): Progress {
  const prev = p.lessons[lessonId];
  if (prev && prev.stars >= stars) return p;
  return touch({ ...p, lessons: { ...p.lessons, [lessonId]: { stars: Math.max(stars, prev?.stars ?? 0), at: prev?.at ?? now } } }, now);
}

export function recordSong(p: Progress, tuneId: string, arr: ArrangementKind, stars: number, accuracy: number, now = Date.now()): Progress {
  const key = songKey(tuneId, arr);
  const prev = p.songs[key];
  const rec: SongRecord = {
    stars: Math.max(stars, prev?.stars ?? 0),
    accuracy: Math.max(accuracy, prev?.accuracy ?? 0),
    plays: (prev?.plays ?? 0) + 1,
    at: now,
  };
  return touch({ ...p, songs: { ...p.songs, [key]: rec } }, now);
}

export function bump(p: Progress, counter: keyof Progress['counters'], by = 1, now = Date.now()): Progress {
  if (!by) return p;
  return touch({ ...p, counters: { ...p.counters, [counter]: p.counters[counter] + by } }, now);
}

// ---------------------------------------------------------------------------------------
// Practice time, daily goal, streak

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addPractice(p: Progress, seconds: number, when = new Date()): Progress {
  if (seconds <= 0) return p;
  const k = dayKey(when);
  return touch({ ...p, days: { ...p.days, [k]: (p.days[k] ?? 0) + seconds } }, when.getTime());
}

/** A day counts toward the streak with at least this much playing. */
export const STREAK_MIN_SECONDS = 60;

/** Consecutive practice days ending today (or yesterday, if today isn't done yet). */
export function streak(p: Progress, today = new Date()): number {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ok = (x: Date) => (p.days[dayKey(x)] ?? 0) >= STREAK_MIN_SECONDS;
  if (!ok(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (ok(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function todaySeconds(p: Progress, today = new Date()): number {
  return p.days[dayKey(today)] ?? 0;
}

// ---------------------------------------------------------------------------------------
// Merge (local guest progress + cloud progress): never lose anything.

function maxRecord<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  return {
    v: 1,
    lessons: maxRecord(a.lessons, b.lessons, (x, y) => ({ stars: Math.max(x.stars, y.stars), at: Math.min(x.at, y.at) })),
    steps: maxRecord(a.steps, b.steps, Math.max),
    songs: maxRecord(a.songs, b.songs, (x, y) => ({
      stars: Math.max(x.stars, y.stars),
      accuracy: Math.max(x.accuracy, y.accuracy),
      plays: Math.max(x.plays, y.plays),
      at: Math.max(x.at, y.at),
    })),
    days: maxRecord(a.days, b.days, Math.max),
    awards: maxRecord(a.awards, b.awards, Math.min),
    counters: Object.fromEntries(Object.keys(a.counters).map((k) => [k, Math.max(a.counters[k as 'notes'], b.counters[k as 'notes'] ?? 0)])) as Progress['counters'],
    placement: newer.placement ?? a.placement ?? b.placement,
    dailyGoalMin: newer.dailyGoalMin,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}
