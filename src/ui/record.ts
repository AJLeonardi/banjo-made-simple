// Turning a finished run into progress: practice time, note/chop counters, perfect runs.
import { addPractice, bump, Progress } from '../state/progress';
import type { PlayResult } from './Player';

export function recordRun(p: Progress, r: PlayResult): Progress {
  let q = addPractice(p, Math.round(r.seconds));
  q = bump(q, 'notes', r.summary.pickHits);
  q = bump(q, 'chops', r.summary.chordHits);
  if (r.perfect) q = bump(q, 'perfect');
  return q;
}
