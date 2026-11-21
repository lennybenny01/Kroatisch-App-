import { describe, expect, it } from 'vitest';
import { buildCardDefs } from '../content';
import { seededRng } from '../lib/random';
import { createScheduler, newSchedulingState } from './scheduler';
import { advanceQueue, buildSession } from './session';
import { CardState, Rating, type CardRecord } from './types';
import { isRecognitionSolid } from './unlock';

const DAY = 86_400_000;
const START = new Date('2026-11-02T08:00:00').getTime();

interface SimResult {
  newPerDay: number[];
  reviewsPerDay: number[];
  cards: Map<string, CardRecord>;
  violations: string[];
}

/**
 * Simulates a learner using the app once per day with the 20 sample words.
 * `answer` decides the rating for each shown card.
 */
function simulate(days: number, newLimit: number, answer: (c: CardRecord, rng: () => number) => Rating, seed = 1): SimResult {
  const rng = seededRng(seed);
  const sched = createScheduler({ fuzz: false });
  const cards = new Map(buildCardDefs().map((d) => [d.id, { ...d, ...newSchedulingState(START) } as CardRecord]));
  const newPerDay: number[] = [];
  const reviewsPerDay: number[] = [];
  const violations: string[] = [];

  for (let day = 0; day < days; day++) {
    let now = START + day * DAY;
    const plan = buildSession({ cards: [...cards.values()], now, newLimit, newIntroducedToday: 0, rng });
    let queue = plan.queue;
    const introduced = new Set<string>();
    let reviews = 0;
    let guard = 0;
    while (queue.length && guard++ < 1000) {
      const id = queue[0]!;
      const card = cards.get(id)!;
      if (card.state === CardState.New) {
        introduced.add(id);
        if (card.requires) {
          const req = cards.get(card.requires)!;
          if (card.kind === 'produce' && !isRecognitionSolid(req)) violations.push(`${id} introduced too early`);
        }
      }
      const next = { ...card, ...sched.review(card, answer(card, rng), now) };
      cards.set(id, next);
      reviews++;
      now += 15_000; // 15 s per card
      queue = advanceQueue(queue, id, next.due, now);
      // learning cards come back once their step has passed
      if (queue[0] === id && next.due > now) now = next.due;
    }
    newPerDay.push(introduced.size);
    reviewsPerDay.push(reviews);
  }
  return { newPerDay, reviewsPerDay, cards, violations };
}

describe('learning simulation with 20 sample words', () => {
  it('perfect learner: limit respected, everything introduced, DE→HR only after HR→DE sits', () => {
    const r = simulate(45, 10, () => Rating.Good);
    expect(r.violations).toEqual([]);
    expect(Math.max(...r.newPerDay)).toBeLessThanOrEqual(10);
    // the 20 recognition cards fill the first two days
    expect(r.newPerDay[0]).toBe(10);
    expect(r.newPerDay[1]).toBe(10);
    // after ~6 weeks every card (incl. DE→HR and cloze) has been introduced and is in review
    const states = [...r.cards.values()].map((c) => c.state);
    expect(states.every((s) => s === CardState.Review)).toBe(true);
  });

  it('DE→HR card of a word is never introduced on the same day as its HR→DE card', () => {
    const r = simulate(10, 20, () => Rating.Good);
    expect(r.violations).toEqual([]);
    expect(r.newPerDay[0]).toBe(20); // only recognize cards available on day 1
  });

  it('workload settles: reviews per day decrease once cards are known', () => {
    const r = simulate(60, 10, () => Rating.Good);
    const week = (w: number) => r.reviewsPerDay.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0);
    expect(week(7)).toBeLessThan(week(1));
  });

  it('struggling learner: forgotten cards return and are relearned, no card gets stuck', () => {
    // 25 % Again, otherwise Good
    const r = simulate(60, 10, (_c, rng) => (rng() < 0.25 ? Rating.Again : Rating.Good), 7);
    expect(r.violations).toEqual([]);
    const cards = [...r.cards.values()];
    expect(cards.some((c) => c.lapses > 0)).toBe(true);
    // every recognition card has been introduced
    expect(cards.filter((c) => c.kind === 'recognize').every((c) => c.state !== CardState.New)).toBe(true);
  });

  it('new limit 0 introduces nothing', () => {
    const r = simulate(5, 0, () => Rating.Good);
    expect(r.newPerDay.every((n) => n === 0)).toBe(true);
  });
});
