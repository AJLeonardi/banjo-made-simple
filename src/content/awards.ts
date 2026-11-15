// Awards: badges earned from progress. Each is a predicate over Progress, checked after
// every update; earning one records its timestamp (see evaluateAwards).

import { COURSES } from './lessons';
import { Progress, streak, totalStars } from '../state/progress';

export type AwardIcon = 'pick' | 'tuner' | 'roll' | 'pinch' | 'star' | 'flame' | 'note' | 'trade' | 'chop' | 'course' | 'book' | 'bolt' | 'sun';

export interface Award {
  id: string;
  title: string;
  description: string;
  icon: AwardIcon;
  tier: 'bronze' | 'silver' | 'gold';
  earned: (p: Progress, today: Date) => boolean;
}

const done = (p: Progress, id: string) => !!p.lessons[id];
const tunesWithStars = (p: Progress) => new Set(Object.entries(p.songs).filter(([, s]) => s.stars > 0).map(([k]) => k.split(':')[0])).size;
const courseDone = (p: Progress, id: string) => COURSES.find((c) => c.id === id)!.lessons.every((l) => done(p, l.id));

export const AWARDS: Award[] = [
  { id: 'first-note', title: 'First Pluck', description: 'Play your first note.', icon: 'pick', tier: 'bronze', earned: (p) => p.counters.notes >= 1 },
  { id: 'in-tune', title: 'In Tune', description: 'Tune your banjo with the tuner.', icon: 'tuner', tier: 'bronze', earned: (p) => p.counters.tuner >= 1 },
  { id: 'pinch', title: 'Pinch Hitter', description: 'Finish the pinch lesson.', icon: 'pinch', tier: 'bronze', earned: (p) => done(p, 'pinch') },
  { id: 'course-first-steps', title: 'Front Porch Picker', description: 'Finish First Steps.', icon: 'course', tier: 'silver', earned: (p) => courseDone(p, 'first-steps') },
  { id: 'forward-roll', title: 'Rollin\'', description: 'Finish the forward roll lesson.', icon: 'roll', tier: 'bronze', earned: (p) => done(p, 'forward-roll') },
  { id: 'course-rolls', title: 'Roll Call', description: 'Finish the Rolls course.', icon: 'course', tier: 'silver', earned: (p) => courseDone(p, 'rolls') },
  { id: 'first-tune', title: 'First Tune', description: 'Play your first tune all the way through.', icon: 'note', tier: 'bronze', earned: (p) => tunesWithStars(p) >= 1 || done(p, 'first-tune') },
  { id: 'course-left-hand', title: 'Fret Setter', description: 'Finish the Left Hand course.', icon: 'course', tier: 'silver', earned: (p) => courseDone(p, 'left-hand') },
  { id: 'course-techniques', title: 'Smooth Moves', description: 'Finish Left-Hand Techniques.', icon: 'course', tier: 'silver', earned: (p) => courseDone(p, 'techniques') },
  { id: 'tuned-up', title: 'Perfect Pitch', description: 'Get five strings in tune with the tuner.', icon: 'tuner', tier: 'bronze', earned: (p) => p.counters.tuner >= 5 },
  { id: 'chop-100', title: 'Chop Shop', description: 'Land 100 vamp chops.', icon: 'chop', tier: 'silver', earned: (p) => p.counters.chops >= 100 },
  { id: 'course-backup', title: 'Rhythm Section', description: 'Finish the Backup course.', icon: 'course', tier: 'gold', earned: (p) => courseDone(p, 'backup') },
  { id: 'first-trade', title: 'Taking a Break', description: 'Trade breaks with the band for the first time.', icon: 'trade', tier: 'silver', earned: (p) => p.counters.trades >= 1 },
  { id: 'trade-10', title: 'Jam Regular', description: 'Trade breaks 10 times.', icon: 'trade', tier: 'gold', earned: (p) => p.counters.trades >= 10 },
  { id: 'course-tunes', title: 'Jam Ready', description: 'Finish Tunes & Trading.', icon: 'course', tier: 'gold', earned: (p) => courseDone(p, 'tunes') },
  { id: 'three-stars', title: 'Gold Standard', description: 'Earn 3 stars on a tune.', icon: 'star', tier: 'silver', earned: (p) => Object.values(p.songs).some((s) => s.stars >= 3) },
  { id: 'perfect', title: 'Clean Run', description: 'Play a tune at full speed without a single miss.', icon: 'bolt', tier: 'gold', earned: (p) => p.counters.perfect >= 1 },
  { id: 'songbook-5', title: 'Songbook', description: 'Earn stars on 5 different tunes.', icon: 'book', tier: 'bronze', earned: (p) => tunesWithStars(p) >= 5 },
  { id: 'songbook-10', title: 'Big Songbook', description: 'Earn stars on 10 different tunes.', icon: 'book', tier: 'silver', earned: (p) => tunesWithStars(p) >= 10 },
  { id: 'songbook-25', title: 'Whole Songbook', description: 'Earn stars on all 25 tunes.', icon: 'book', tier: 'gold', earned: (p) => tunesWithStars(p) >= 25 },
  { id: 'stars-25', title: 'Star Picker', description: 'Collect 25 stars.', icon: 'star', tier: 'bronze', earned: (p) => totalStars(p) >= 25 },
  { id: 'stars-75', title: 'Constellation', description: 'Collect 75 stars.', icon: 'star', tier: 'gold', earned: (p) => totalStars(p) >= 75 },
  { id: 'notes-1000', title: 'Thousand Notes', description: 'Play 1,000 correct notes.', icon: 'note', tier: 'silver', earned: (p) => p.counters.notes >= 1000 },
  { id: 'streak-3', title: 'Three-Day Run', description: 'Practice 3 days in a row.', icon: 'flame', tier: 'bronze', earned: (p, d) => streak(p, d) >= 3 },
  { id: 'streak-7', title: 'Week of Picking', description: 'Practice 7 days in a row.', icon: 'flame', tier: 'silver', earned: (p, d) => streak(p, d) >= 7 },
  { id: 'streak-30', title: 'Month of Mountain Music', description: 'Practice 30 days in a row.', icon: 'flame', tier: 'gold', earned: (p, d) => streak(p, d) >= 30 },
  { id: 'workout', title: 'Warmed Up', description: 'Finish a Daily Workout.', icon: 'sun', tier: 'bronze', earned: (p) => p.counters.workouts >= 1 },
];

export const AWARD_BY_ID: Record<string, Award> = Object.fromEntries(AWARDS.map((a) => [a.id, a]));

/** Record newly earned awards. Returns the updated progress and the new award ids. */
export function evaluateAwards(p: Progress, today = new Date()): { progress: Progress; earned: string[] } {
  const earned = AWARDS.filter((a) => !p.awards[a.id] && a.earned(p, today)).map((a) => a.id);
  if (!earned.length) return { progress: p, earned };
  const now = today.getTime();
  return { progress: { ...p, awards: { ...p.awards, ...Object.fromEntries(earned.map((id) => [id, now])) }, updatedAt: now }, earned };
}
