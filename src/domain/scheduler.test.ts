import { describe, expect, it } from 'vitest';
import { createScheduler, formatInterval, newSchedulingState } from './scheduler';
import { CardState, Rating, type SchedulingState } from './types';

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = new Date('2026-11-01T10:00:00Z').getTime();
const s = createScheduler({ fuzz: false });

/** Answers a card repeatedly, each time exactly when it is due. */
function reviewChain(ratings: Rating[], start = newSchedulingState(T0)): SchedulingState[] {
  const out: SchedulingState[] = [];
  let cur = start;
  let now = T0;
  for (const r of ratings) {
    cur = s.review(cur, r, now);
    out.push(cur);
    now = cur.due;
  }
  return out;
}

describe('scheduler (FSRS)', () => {
  it('creates new cards that are due immediately', () => {
    const c = newSchedulingState(T0);
    expect(c.state).toBe(CardState.New);
    expect(c.due).toBe(T0);
    expect(c.reps).toBe(0);
  });

  it('new card: Again < Hard < Good < Easy in interval', () => {
    const p = s.preview(newSchedulingState(T0), T0);
    const iv = (r: Rating) => p[r].due - T0;
    expect(iv(Rating.Again)).toBeLessThan(iv(Rating.Hard));
    expect(iv(Rating.Hard)).toBeLessThan(iv(Rating.Good));
    expect(iv(Rating.Good)).toBeLessThan(iv(Rating.Easy));
  });

  it('uses learning steps of 1 min and 10 min for new cards', () => {
    const p = s.preview(newSchedulingState(T0), T0);
    expect(p[Rating.Again].due - T0).toBe(1 * MIN);
    expect(p[Rating.Again].state).toBe(CardState.Learning);
    expect(p[Rating.Good].due - T0).toBe(10 * MIN);
    expect(p[Rating.Good].state).toBe(CardState.Learning);
    // Easy skips the learning steps
    expect(p[Rating.Easy].state).toBe(CardState.Review);
    expect(p[Rating.Easy].due - T0).toBeGreaterThanOrEqual(1 * DAY);
  });

  it('graduates to Review after passing the learning steps', () => {
    const [, second] = reviewChain([Rating.Good, Rating.Good]);
    expect(second!.state).toBe(CardState.Review);
    expect(second!.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it('intervals keep growing with successful reviews', () => {
    const chain = reviewChain([Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good, Rating.Good]);
    const reviews = chain.filter((c) => c.state === CardState.Review).map((c) => c.scheduledDays);
    expect(reviews.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < reviews.length; i++) expect(reviews[i]!).toBeGreaterThan(reviews[i - 1]!);
    // Stability grows as well
    const stab = chain.map((c) => c.stability);
    expect(stab.at(-1)!).toBeGreaterThan(stab[2]!);
  });

  it('forgetting a review card counts a lapse and sends it to relearning', () => {
    const chain = reviewChain([Rating.Good, Rating.Good, Rating.Good, Rating.Again]);
    const lapsed = chain.at(-1)!;
    const before = chain.at(-2)!;
    expect(lapsed.state).toBe(CardState.Relearning);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThan(before.stability);
    expect(lapsed.due - before.due).toBe(10 * MIN); // relearning step
  });

  it('Hard on a review card gives a shorter interval than Good, Easy a longer one', () => {
    const review = reviewChain([Rating.Good, Rating.Good, Rating.Good]).at(-1)!;
    const p = s.preview(review, review.due);
    expect(p[Rating.Hard].scheduledDays).toBeLessThan(p[Rating.Good].scheduledDays);
    expect(p[Rating.Good].scheduledDays).toBeLessThan(p[Rating.Easy].scheduledDays);
  });

  it('difficulty rises with Again/Hard and falls with Easy', () => {
    const base = reviewChain([Rating.Good, Rating.Good]).at(-1)!;
    const p = s.preview(base, base.due);
    expect(p[Rating.Again].difficulty).toBeGreaterThan(base.difficulty);
    expect(p[Rating.Hard].difficulty).toBeGreaterThan(base.difficulty);
    expect(p[Rating.Easy].difficulty).toBeLessThan(base.difficulty);
  });

  it('is pure: does not mutate the input state', () => {
    const c = newSchedulingState(T0);
    const copy = structuredClone(c);
    s.review(c, Rating.Good, T0);
    expect(c).toEqual(copy);
  });

  it('round-trips the stored format (numbers, no Date objects)', () => {
    const next = s.review(newSchedulingState(T0), Rating.Good, T0);
    expect(typeof next.due).toBe('number');
    expect(next.lastReview).toBe(T0);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });

  it('retrievability drops over time', () => {
    const review = reviewChain([Rating.Good, Rating.Good, Rating.Good]).at(-1)!;
    const r1 = s.retrievability(review, review.lastReview! + 1 * DAY);
    const r2 = s.retrievability(review, review.lastReview! + 30 * DAY);
    expect(r1).toBeGreaterThan(r2);
    // at the due date retrievability is close to the requested 90 %
    expect(s.retrievability(review, review.due)).toBeGreaterThan(0.85);
    expect(s.retrievability(review, review.due)).toBeLessThan(0.95);
  });

  it('respects a higher target retention with shorter intervals', () => {
    const strict = createScheduler({ fuzz: false, retention: 0.95 });
    const review = reviewChain([Rating.Good, Rating.Good, Rating.Good]).at(-1)!;
    expect(strict.review(review, Rating.Good, review.due).scheduledDays).toBeLessThan(
      s.review(review, Rating.Good, review.due).scheduledDays,
    );
  });
});

describe('formatInterval', () => {
  it.each([
    [30_000, '1 Min'],
    [10 * MIN, '10 Min'],
    [3 * 60 * MIN, '3 Std'],
    [3 * DAY, '3 T'],
    [60 * DAY, '2 Mon'],
    [400 * DAY, '1,1 J'],
    [730 * DAY, '2 J'],
  ])('%d ms → %s', (ms, label) => expect(formatInterval(ms)).toBe(label));
});

describe('robustness', () => {
  it('clamps an invalid memory state instead of throwing', () => {
    const broken = { ...newSchedulingState(T0), state: CardState.Review, stability: 5, difficulty: 0, reps: 2, lastReview: T0 - DAY };
    const next = s.review(broken, Rating.Good, T0);
    expect(next.difficulty).toBeGreaterThanOrEqual(1);
    expect(next.due).toBeGreaterThan(T0);
    expect(() => s.preview({ ...broken, stability: NaN }, T0)).not.toThrow();
  });
});
