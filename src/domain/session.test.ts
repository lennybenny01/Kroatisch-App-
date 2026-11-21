import { describe, expect, it } from 'vitest';
import { cardId } from '../content';
import { sampleContent } from '../content/fixtures/sample';

const { words } = sampleContent;
import { seededRng } from '../lib/random';
import {
  advanceQueue,
  buildSession,
  dueCards,
  eligibleNewCards,
  interleaveByGroup,
  LEARN_AHEAD_MS,
  separateSiblings,
  spreadEvenly,
} from './session';
import { DAY, freshCards, MIN, T0 } from './testUtils';
import { CardState, type CardRecord } from './types';

const asReview = (c: CardRecord, patch: Partial<CardRecord> = {}): CardRecord => ({
  ...c,
  state: CardState.Review,
  stability: 10,
  reps: 3,
  due: T0 - DAY,
  ...patch,
});

describe('sample content', () => {
  it('has 20 sample words', () => expect(words).toHaveLength(20));

  it('every word yields a recognize and a produce card', () => {
    const ids = new Set(freshCards().map((c) => c.id));
    for (const w of words) {
      expect(ids.has(cardId.recognize(w.id))).toBe(true);
      expect(ids.has(cardId.produce(w.id))).toBe(true);
    }
  });
});

describe('eligibleNewCards', () => {
  it('fresh deck: only HR→DE recognition cards, in curriculum order', () => {
    const elig = eligibleNewCards(freshCards());
    expect(elig).toHaveLength(20);
    expect(elig.every((c) => c.kind === 'recognize')).toBe(true);
    expect(elig[0]!.id).toBe(cardId.recognize('w_bok'));
    expect(elig.map((c) => c.order)).toEqual([...elig.map((c) => c.order)].sort((a, b) => a - b));
  });

  it('DE→HR appears once recognition sits, alternating with fresh words', () => {
    // kava sits; molim (the other word in „Molim jednu kavu.“) has been seen
    const seen = new Set([cardId.recognize('w_kava'), cardId.recognize('w_molim')]);
    const cards = freshCards().map((c) => (seen.has(c.id) ? asReview(c) : c));
    const elig = eligibleNewCards(cards);
    expect(elig.map((c) => c.id)).toContain(cardId.produce('w_kava'));
    expect(elig.map((c) => c.id)).toContain(cardId.cloze('s_kavu'));
    expect(elig.map((c) => c.id)).not.toContain(cardId.recognize('w_kava'));
    // follow-up, fresh, follow-up, fresh …
    expect(elig[0]!.kind).not.toBe('recognize');
    expect(elig[1]!.kind).toBe('recognize');
    expect(elig[2]!.kind).not.toBe('recognize');
  });

  it('cloze waits until every other word of the sentence has been seen (i+1)', () => {
    const cards = freshCards().map((c) => (c.id === cardId.recognize('w_kava') ? asReview(c) : c));
    expect(eligibleNewCards(cards).map((c) => c.id)).not.toContain(cardId.cloze('s_kavu'));
  });

  it('only offers new cards from unlocked units', () => {
    const elig = eligibleNewCards(freshCards(), new Set(['u02_kafic']));
    expect(elig.length).toBe(5);
    expect(elig.every((c) => c.unitId === 'u02_kafic')).toBe(true);
  });

  it('suspended cards are never offered', () => {
    const cards = freshCards().map((c) => (c.id === cardId.recognize('w_bok') ? { ...c, suspended: true } : c));
    expect(eligibleNewCards(cards).map((c) => c.id)).not.toContain(cardId.recognize('w_bok'));
  });
});

describe('dueCards', () => {
  it('returns only non-new, unsuspended cards whose due time has passed', () => {
    const [a, b, c, d] = freshCards();
    const cards = [asReview(a!), asReview(b!, { due: T0 + DAY }), c!, asReview(d!, { suspended: true })];
    expect(dueCards(cards, T0).map((x) => x.id)).toEqual([a!.id]);
  });
});

describe('buildSession', () => {
  it('respects the daily new-card limit', () => {
    const plan = buildSession({ cards: freshCards(), now: T0, newLimit: 10, newIntroducedToday: 0, rng: seededRng(1) });
    expect(plan.newCount).toBe(10);
    expect(plan.queue).toHaveLength(10);
  });

  it('subtracts cards already introduced today', () => {
    const plan = buildSession({ cards: freshCards(), now: T0, newLimit: 10, newIntroducedToday: 7, rng: seededRng(1) });
    expect(plan.newCount).toBe(3);
    const none = buildSession({ cards: freshCards(), now: T0, newLimit: 10, newIntroducedToday: 12, rng: seededRng(1) });
    expect(none.newCount).toBe(0);
  });

  it('includes all due reviews regardless of the new limit', () => {
    const cards = freshCards().map((c) => (c.kind === 'recognize' ? asReview(c) : c));
    const plan = buildSession({ cards, now: T0, newLimit: 0, newIntroducedToday: 0, rng: seededRng(1) });
    expect(plan.dueCount).toBe(20);
    expect(plan.queue).toHaveLength(20);
  });

  it('interleaves topics: no long runs from the same unit', () => {
    const cards = freshCards().map((c) => (c.kind === 'recognize' ? asReview(c) : c));
    const plan = buildSession({ cards, now: T0, newLimit: 0, newIntroducedToday: 0, rng: seededRng(3) });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const units = plan.queue.map((id) => byId.get(id)!.unitId);
    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < units.length; i++) {
      run = units[i] === units[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    // 4 units with 6/5/5/4 cards → round robin leaves at most a short tail
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('mixes new cards between reviews instead of appending them', () => {
    const cards = freshCards().map((c) => (c.kind === 'recognize' && c.unitId !== 'u04_svakodnevica' ? asReview(c) : c));
    const plan = buildSession({ cards, now: T0, newLimit: 4, newIntroducedToday: 0, rng: seededRng(5) });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const newPositions = plan.queue.map((id, i) => (byId.get(id)!.state === CardState.New ? i : -1)).filter((i) => i >= 0);
    expect(newPositions).toHaveLength(4);
    expect(newPositions[0]).toBeGreaterThan(0);
    expect(newPositions.at(-1)).toBeLessThan(plan.queue.length - 1);
  });

  it('never shows two cards of the same word back to back', () => {
    // recognize cards due + their cloze/produce follow-ups new
    const cards = freshCards().map((c) => (c.kind === 'recognize' ? asReview(c) : c));
    for (let seed = 0; seed < 20; seed++) {
      const plan = buildSession({ cards, now: T0, newLimit: 20, newIntroducedToday: 0, rng: seededRng(seed) });
      const byId = new Map(cards.map((c) => [c.id, c]));
      const wordsSeq = plan.queue.map((id) => byId.get(id)!.wordId);
      for (let i = 1; i < wordsSeq.length; i++) expect(wordsSeq[i]).not.toBe(wordsSeq[i - 1]);
    }
  });

  it('contains no duplicates', () => {
    const cards = freshCards().map((c) => (c.kind === 'recognize' ? asReview(c) : c));
    const plan = buildSession({ cards, now: T0, newLimit: 50, newIntroducedToday: 0, rng: seededRng(9) });
    expect(new Set(plan.queue).size).toBe(plan.queue.length);
  });
});

describe('helpers', () => {
  it('interleaveByGroup round-robins and keeps order within groups', () => {
    const items = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1'];
    const out = interleaveByGroup(items, (s) => s[0]!, seededRng(2));
    expect(out).toHaveLength(6);
    expect(out.filter((s) => s.startsWith('a'))).toEqual(['a1', 'a2', 'a3']);
    expect(new Set(out.slice(0, 3).map((s) => s[0]))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('spreadEvenly distributes inserts', () => {
    expect(spreadEvenly<number | string>([1, 2, 3, 4, 5, 6], ['x', 'y'])).toEqual([1, 2, 'x', 3, 4, 'y', 5, 6]);
    expect(spreadEvenly([], ['x'])).toEqual(['x']);
    expect(spreadEvenly([1], [])).toEqual([1]);
  });

  it('separateSiblings swaps adjacent duplicates apart', () => {
    expect(separateSiblings(['a', 'a', 'b', 'c'], (s) => s)).toEqual(['a', 'b', 'a', 'c']);
  });
});

describe('advanceQueue (in-session repetition)', () => {
  const q = ['x', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('removes a card that is due later than the learn-ahead window', () => {
    expect(advanceQueue(q, 'x', T0 + LEARN_AHEAD_MS + MIN, T0)).toEqual(q.slice(1));
  });

  it('“Nochmal” (1 min) brings the card back after 3 others', () => {
    expect(advanceQueue(q, 'x', T0 + MIN, T0)).toEqual(['a', 'b', 'c', 'x', 'd', 'e', 'f', 'g']);
  });

  it('10-minute step brings the card back a bit later', () => {
    expect(advanceQueue(q, 'x', T0 + 10 * MIN, T0).indexOf('x')).toBe(6);
  });

  it('appends at the end when the queue is short', () => {
    expect(advanceQueue(['x', 'a'], 'x', T0 + MIN, T0)).toEqual(['a', 'x']);
    expect(advanceQueue(['x'], 'x', T0 + MIN, T0)).toEqual(['x']);
  });
});

describe('separateSiblings edge cases', () => {
  it('moves a trailing duplicate to an earlier gap', () => {
    const out = separateSiblings(['a', 'b', 'c', 'c'], (s) => s);
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'c']);
  });
  it('leaves unavoidable runs alone', () => {
    expect(separateSiblings(['a', 'a'], (s) => s)).toEqual(['a', 'a']);
  });
});
