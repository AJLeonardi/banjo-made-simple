import { describe, expect, it } from 'vitest';
import { AWARDS, evaluateAwards } from '../src/content/awards';
import { ALL_LESSONS, COURSES, isTab, LESSON_BY_ID, PLACEMENT } from '../src/content/lessons';
import { ARRANGEMENT_UNLOCK, TUNE_BY_ID, TUNES, tuneTab } from '../src/content/songs';
import {
  addPractice, arrangementUnlocked, completeLesson, dayKey, emptyProgress, lessonUnlocked, mergeProgress,
  nextLesson, normalize, recordSong, starsFor, streak, totalStars, tuneUnlocked,
} from '../src/state/progress';

describe('content is consistent', () => {
  it('lesson ids are unique and every reference resolves', () => {
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length);
    for (const t of TUNES) if ('lesson' in t.unlock) expect(LESSON_BY_ID[t.unlock.lesson], t.id).toBeTruthy();
    for (const id of Object.values(ARRANGEMENT_UNLOCK)) if (id) expect(LESSON_BY_ID[id]).toBeTruthy();
    for (const id of Object.values(PLACEMENT)) expect(LESSON_BY_ID[id]).toBeTruthy();
    for (const l of ALL_LESSONS)
      l.steps.forEach((s, i) => {
        if (s.kind === 'play') {
          if (isTab(s.source)) expect(s.source.events.length, `${l.id}#${i}`).toBeGreaterThan(0);
          else {
            const t = TUNE_BY_ID[s.source.tune];
            expect(t, `${l.id}#${i}`).toBeTruthy();
            if (s.source.part) expect(t.parts.map((p) => p.name)).toContain(s.source.part);
            expect(tuneTab(t, s.source.arrangement).events.length).toBeGreaterThan(0);
          }
          if (s.mode === 'tempo') expect(s.bpm, `${l.id}#${i} needs a tempo`).toBeGreaterThan(0);
        }
        if (s.kind === 'trade') expect(TUNE_BY_ID[s.tune]).toBeTruthy();
      });
  });

  it('a lesson that unlocks a tune comes after the lessons its arrangement needs', () => {
    const order = new Map(ALL_LESSONS.map((l, i) => [l.id, i]));
    for (const l of ALL_LESSONS)
      for (const s of l.steps) {
        const needs = s.kind === 'play' && !isTab(s.source) ? [s.source.arrangement] : s.kind === 'trade' ? [s.lead, 'backup' as const] : [];
        for (const a of needs) {
          const req = ARRANGEMENT_UNLOCK[a];
          if (req && req !== l.id) expect(order.get(req)!, `${l.id} uses ${a}`).toBeLessThan(order.get(l.id)!);
        }
      }
  });
});

describe('progress', () => {
  it('stars from accuracy, with caps', () => {
    expect(starsFor(0.5)).toBe(0);
    expect(starsFor(0.6)).toBe(1);
    expect(starsFor(0.85)).toBe(2);
    expect(starsFor(0.97)).toBe(3);
    expect(starsFor(0.97, 1)).toBe(1);
  });

  it('unlocks lessons in order, honouring placement', () => {
    let p = emptyProgress();
    expect(lessonUnlocked(p, 'meet-banjo')).toBe(true);
    expect(lessonUnlocked(p, 'picking-hand')).toBe(false);
    p = completeLesson(p, 'meet-banjo', 2);
    expect(lessonUnlocked(p, 'picking-hand')).toBe(true);
    expect(nextLesson(p)).toBe('picking-hand');
    const placed = { ...emptyProgress(), placement: 'some' as const };
    expect(lessonUnlocked(placed, 'alt-thumb')).toBe(true);
    expect(lessonUnlocked(placed, 'meet-banjo')).toBe(true);
    expect(lessonUnlocked(placed, 'forward-roll')).toBe(false);
  });

  it('earns tunes from lessons and from stars; arrangements need their lessons', () => {
    let p = emptyProgress();
    const boil = TUNE_BY_ID['boil-cabbage'];
    const grace = TUNE_BY_ID['amazing-grace'];
    expect(tuneUnlocked(p, boil)).toBe(false);
    p = completeLesson(p, 'first-tune', 3);
    expect(tuneUnlocked(p, boil)).toBe(true);
    expect(tuneUnlocked(p, grace)).toBe(true); // 3 stars
    expect(arrangementUnlocked(p, 'melody')).toBe(false); // needs the fretting lesson
    p = completeLesson(p, 'fretting', 1);
    expect(arrangementUnlocked(p, 'melody')).toBe(true);
    expect(arrangementUnlocked(p, 'scruggs')).toBe(false);
    p = completeLesson(p, 'roll-changes', 1);
    expect(arrangementUnlocked(p, 'scruggs')).toBe(true);
  });

  it('keeps best results', () => {
    let p = recordSong(emptyProgress(), 'cindy', 'melody', 2, 0.85, 1);
    p = recordSong(p, 'cindy', 'melody', 1, 0.7, 2);
    expect(p.songs['cindy:melody']).toMatchObject({ stars: 2, accuracy: 0.85, plays: 2 });
    p = completeLesson(p, 'pinch', 3, 3);
    p = completeLesson(p, 'pinch', 1, 4);
    expect(p.lessons.pinch.stars).toBe(3);
    expect(totalStars(p)).toBe(5);
  });

  it('counts a streak of practice days', () => {
    const today = new Date(2026, 10, 15, 12);
    let p = emptyProgress();
    for (const back of [0, 1, 2, 4]) p = addPractice(p, 120, new Date(2026, 10, 15 - back, 9));
    expect(streak(p, today)).toBe(3);
    // Not practiced yet today: the streak through yesterday still stands.
    const q = { ...p, days: { ...p.days, [dayKey(today)]: 0 } };
    expect(streak(q, today)).toBe(2);
  });

  it('merging guest and cloud progress loses nothing', () => {
    let a = completeLesson(emptyProgress(), 'meet-banjo', 2, 10);
    a = recordSong(a, 'cindy', 'melody', 1, 0.7, 11);
    let b = completeLesson(emptyProgress(), 'meet-banjo', 3, 20);
    b = completeLesson(b, 'pinch', 1, 21);
    b = { ...b, awards: { 'first-note': 5 }, counters: { ...b.counters, notes: 40 } };
    const m = mergeProgress(a, b);
    expect(m.lessons['meet-banjo'].stars).toBe(3);
    expect(m.lessons.pinch).toBeTruthy();
    expect(m.songs['cindy:melody'].stars).toBe(1);
    expect(m.awards['first-note']).toBe(5);
    expect(m.counters.notes).toBe(40);
    expect(mergeProgress(m, a)).toEqual(m);
  });

  it('normalizes partial/old data', () => {
    const p = normalize({ lessons: { pinch: { stars: 1, at: 1 } } } as never);
    expect(p.counters.notes).toBe(0);
    expect(p.lessons.pinch.stars).toBe(1);
    expect(normalize(null)).toEqual(emptyProgress());
  });
});

describe('awards', () => {
  it('earns awards once, from progress', () => {
    let p = emptyProgress();
    p = { ...p, counters: { ...p.counters, notes: 1 } };
    const r = evaluateAwards(p, new Date(2026, 0, 1));
    expect(r.earned).toEqual(['first-note']);
    expect(evaluateAwards(r.progress).earned).toEqual([]);
  });

  it('every course has a completion award and ids are unique', () => {
    expect(new Set(AWARDS.map((a) => a.id)).size).toBe(AWARDS.length);
    for (const c of COURSES) expect(AWARDS.some((a) => a.id === `course-${c.id}`), c.id).toBe(true);
  });
});
