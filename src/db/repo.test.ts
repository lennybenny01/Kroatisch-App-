import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCardDefs, cardId } from '../content';
import { createScheduler } from '../domain/scheduler';
import { CardState, Rating } from '../domain/types';
import { dayKey } from '../lib/date';
import { PricajDB } from './db';
import { countNewIntroduced, getSettings, recordReview, resetProgress, syncCards, updateSettings } from './repo';

const T0 = new Date('2026-11-02T09:00:00').getTime();
const sched = createScheduler({ fuzz: false });
const meta = { wasMultipleChoice: false, durationMs: 1000 };
let db: PricajDB;

beforeEach(async () => {
  db = new PricajDB(`test-${Math.random()}`);
  await syncCards(db, buildCardDefs(), T0);
});
afterEach(async () => {
  await db.delete();
});

describe('syncCards', () => {
  it('creates one card per definition, all new', async () => {
    const cards = await db.cards.toArray();
    expect(cards).toHaveLength(buildCardDefs().length);
    expect(cards.every((c) => c.state === CardState.New)).toBe(true);
  });

  it('is idempotent and keeps learning progress', async () => {
    const id = cardId.recognize('w_kava');
    await recordReview(db, id, Rating.Good, meta, T0, sched);
    const before = await db.cards.get(id);
    await syncCards(db, buildCardDefs(), T0 + 1000);
    expect(await db.cards.get(id)).toEqual(before);
    expect(await db.cards.count()).toBe(buildCardDefs().length);
  });

  it('removes cards whose content no longer exists', async () => {
    const defs = buildCardDefs().filter((d) => d.wordId !== 'w_kava');
    await syncCards(db, defs, T0);
    expect(await db.cards.get(cardId.recognize('w_kava'))).toBeUndefined();
  });
});

describe('recordReview', () => {
  it('updates the card via FSRS and writes a log entry', async () => {
    const id = cardId.recognize('w_hvala');
    const next = await recordReview(db, id, Rating.Good, { ...meta, answer: 'danke', verdict: 'correct' }, T0, sched);
    expect(next.state).toBe(CardState.Learning);
    expect(next.reps).toBe(1);
    const logs = await db.reviewLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ cardId: id, rating: Rating.Good, stateBefore: CardState.New, answer: 'danke', day: dayKey(T0) });
  });

  it('throws for unknown cards', async () => {
    await expect(recordReview(db, 'nope', Rating.Good, meta, T0, sched)).rejects.toThrow();
  });
});

describe('countNewIntroduced', () => {
  it('counts distinct new cards per day, not repetitions', async () => {
    const a = cardId.recognize('w_bok');
    const b = cardId.recognize('w_da');
    await recordReview(db, a, Rating.Again, meta, T0, sched);
    await recordReview(db, a, Rating.Good, meta, T0 + 60_000, sched); // now learning → not new anymore
    await recordReview(db, b, Rating.Good, meta, T0 + 120_000, sched);
    expect(await countNewIntroduced(db, dayKey(T0))).toBe(2);
    expect(await countNewIntroduced(db, dayKey(T0 + 86_400_000))).toBe(0);
  });
});

describe('settings', () => {
  it('returns defaults and persists changes', async () => {
    expect((await getSettings(db)).newCardsPerDay).toBe(10);
    await updateSettings(db, { newCardsPerDay: 15 });
    expect((await getSettings(db)).newCardsPerDay).toBe(15);
    expect((await getSettings(db)).theme).toBe('system');
  });
});

describe('resetProgress', () => {
  it('clears logs and resets cards, keeps settings', async () => {
    await updateSettings(db, { newCardsPerDay: 5 });
    await recordReview(db, cardId.recognize('w_bok'), Rating.Good, meta, T0, sched);
    await resetProgress(db, T0);
    expect(await db.reviewLogs.count()).toBe(0);
    expect((await db.cards.toArray()).every((c) => c.state === CardState.New)).toBe(true);
    expect((await getSettings(db)).newCardsPerDay).toBe(5);
  });
});
