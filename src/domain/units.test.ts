import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { sampleContent } from '../content/fixtures/sample';
import { seededRng } from '../lib/random';
import { createScheduler, newSchedulingState } from './scheduler';
import { advanceQueue, buildSession } from './session';
import { DAY, freshCards, T0 } from './testUtils';
import { CardState, Rating, type CardRecord } from './types';
import { computeUnlockedUnits, UNIT_UNLOCK_THRESHOLD, unitMastery } from './units';

const units = sampleContent.units;
const solid = (c: CardRecord): CardRecord => ({ ...c, state: CardState.Review, stability: 10, due: T0 + 5 * DAY });

/** Marks the first `n` recognize cards of a unit as mastered. */
function masterWords(cards: CardRecord[], unitId: string, n: number): CardRecord[] {
  let left = n;
  return cards.map((c) => (c.unitId === unitId && c.kind === 'recognize' && left-- > 0 ? solid(c) : c));
}

describe('unitMastery', () => {
  it('counts mastered (solid) words of a unit', () => {
    const cards = masterWords(freshCards(), 'u01_pozdravi', 3);
    expect(unitMastery('u01_pozdravi', cards)).toEqual({ mastered: 3, total: 6, ratio: 0.5 });
  });

  it('learning or weak cards do not count as mastered', () => {
    const cards = freshCards().map((c) =>
      c.unitId === 'u01_pozdravi' && c.kind === 'recognize' ? { ...c, state: CardState.Review, stability: 1 } : c,
    );
    expect(unitMastery('u01_pozdravi', cards).mastered).toBe(0);
  });
});

describe('computeUnlockedUnits', () => {
  it('the first unit is always open, the rest locked at the start', () => {
    expect([...computeUnlockedUnits(units, freshCards())]).toEqual(['u01_pozdravi']);
  });

  it('opens the next unit at 80 % mastery of the previous one', () => {
    // unit 1 has 6 words: 4/6 = 67 % → locked, 5/6 = 83 % → open
    expect(computeUnlockedUnits(units, masterWords(freshCards(), 'u01_pozdravi', 4)).has('u02_kafic')).toBe(false);
    expect(computeUnlockedUnits(units, masterWords(freshCards(), 'u01_pozdravi', 5)).has('u02_kafic')).toBe(true);
    expect(UNIT_UNLOCK_THRESHOLD).toBe(0.8);
  });

  it('opens units only in sequence', () => {
    // unit 2 mastered, but unit 1 not → unit 2 stays locked, so unit 3 too
    const cards = masterWords(freshCards(), 'u02_kafic', 5);
    const open = computeUnlockedUnits(units, cards);
    expect(open.has('u02_kafic')).toBe(false);
    expect(open.has('u03_obitelj')).toBe(false);
  });

  it('can open several units at once', () => {
    let cards = masterWords(freshCards(), 'u01_pozdravi', 6);
    cards = masterWords(cards, 'u02_kafic', 5);
    expect([...computeUnlockedUnits(units, cards)]).toEqual(['u01_pozdravi', 'u02_kafic', 'u03_obitelj']);
  });

  it('a unit never locks again once it was unlocked', () => {
    const open = computeUnlockedUnits(units, freshCards(), ['u01_pozdravi', 'u02_kafic']);
    expect(open.has('u02_kafic')).toBe(true);
  });
});

describe('course simulation (A1 + A2) with unit unlocking', () => {
  it('a diligent learner works through all 17 units in order, each opening only after 80 % of the previous', { timeout: 30_000 }, () => {
    const sched = createScheduler({ fuzz: false });
    const rng = seededRng(42);
    const cards = new Map(content.cardDefs.map((d) => [d.id, { ...d, ...newSchedulingState(T0) } as CardRecord]));
    let unlocked = new Set<string>();
    const openedOnDay = new Map<string, number>();
    const violations: string[] = [];

    for (let day = 0; day < 240; day++) {
      let now = T0 + day * DAY;
      const all = [...cards.values()];
      const before = new Set(unlocked);
      unlocked = computeUnlockedUnits(content.units, all, unlocked);
      for (const u of unlocked) {
        if (before.has(u)) continue;
        openedOnDay.set(u, day);
        const idx = content.units.findIndex((x) => x.id === u);
        if (idx > 0 && unitMastery(content.units[idx - 1]!.id, all).ratio < 0.8) violations.push(`${u} opened too early`);
      }
      const plan = buildSession({ cards: all, now, newLimit: 20, newIntroducedToday: 0, unlockedUnits: unlocked, rng });
      let queue = plan.queue;
      let guard = 0;
      while (queue.length && guard++ < 3000) {
        const id = queue[0]!;
        const card = cards.get(id)!;
        if (card.state === CardState.New && !unlocked.has(card.unitId)) violations.push(`${id} from locked unit`);
        // 90 % right
        const next = { ...card, ...sched.review(card, rng() < 0.1 ? Rating.Again : Rating.Good, now) };
        cards.set(id, next);
        now += 20_000;
        queue = advanceQueue(queue, id, next.due, now);
        if (queue[0] === id && next.due > now) now = next.due;
      }
    }

    expect(violations).toEqual([]);
    // all 7 units opened, strictly one after another
    const days = content.units.map((u) => openedOnDay.get(u.id));
    expect(days.every((d) => d !== undefined)).toBe(true);
    for (let i = 1; i < days.length; i++) expect(days[i]!).toBeGreaterThan(days[i - 1]!);
    // every card – words in both directions and all cloze sentences – was introduced
    const stillNew = [...cards.values()].filter((c) => c.state === CardState.New);
    expect(stillNew.map((c) => c.id)).toEqual([]);
  });
});
