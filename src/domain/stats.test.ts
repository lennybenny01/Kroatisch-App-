import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cardId, content } from '../content';
import { sampleContent } from '../content/fixtures/sample';
import { backupFileName, BackupError, createBackup, parseBackup, restoreBackup } from '../db/backup';
import { PricajDB } from '../db/db';
import { getSettings, recordReview, syncCards, updateSettings } from '../db/repo';
import { dayKey } from '../lib/date';
import { seededRng } from '../lib/random';
import { createScheduler, newSchedulingState } from './scheduler';
import {
  accuracyByWeek,
  activityByDay,
  calendarGrid,
  cardStatus,
  dueForecast,
  focusCards,
  heatLevel,
  levelProgress,
  statusCounts,
  streaks,
  weakSpots,
} from './stats';
import { DAY, freshCards, T0 } from './testUtils';
import { CardState, Rating, type CardRecord, type ReviewLog } from './types';

const review = (c: CardRecord, stability: number, patch: Partial<CardRecord> = {}): CardRecord => ({
  ...c,
  state: CardState.Review,
  stability,
  reps: 3,
  due: T0 + DAY,
  ...patch,
});

const log = (cardId: string, ts: number, rating: Rating, extra: Partial<ReviewLog> = {}): ReviewLog => ({
  cardId,
  ts,
  day: dayKey(ts),
  rating,
  stateBefore: CardState.Review,
  wasMultipleChoice: false,
  durationMs: 1000,
  ...extra,
});

describe('levelProgress', () => {
  const allCards = () => content.cardDefs.map((d) => ({ ...d, ...newSchedulingState(T0) }) as CardRecord);
  const masterLevel = (cards: CardRecord[], level: string, share: number) => {
    const ids = new Set(content.units.filter((u) => u.level === level).map((u) => u.id));
    const rec = cards.filter((c) => c.kind === 'recognize' && ids.has(c.unitId));
    const n = Math.ceil(rec.length * share);
    const pick = new Set(rec.slice(0, n).map((c) => c.id));
    return cards.map((c) => (pick.has(c.id) ? review(c, 10) : c));
  };

  it('beginner: no level reached, working towards A1', () => {
    const p = levelProgress(allCards(), content);
    expect(p.current).toBeUndefined();
    expect(p.next?.level).toBe('A1');
    expect(p.toNext).toBe(0);
  });

  it('A1 reached at 80 % mastered words; bar then measures A2', () => {
    let cards = masterLevel(allCards(), 'A1', 0.5);
    let p = levelProgress(cards, content);
    expect(p.current).toBeUndefined();
    expect(p.toNext).toBeCloseTo(0.5 / 0.8, 2);
    cards = masterLevel(allCards(), 'A1', 0.8);
    cards = masterLevel(cards, 'A2', 0.4);
    p = levelProgress(cards, content);
    expect(p.current).toBe('A1');
    expect(p.next?.level).toBe('A2');
    expect(p.toNext).toBeCloseTo(0.5, 1);
  });

  it('B1 and B2 exist as levels without content yet', () => {
    const p = levelProgress(allCards(), content);
    expect(p.levels.map((l) => l.level)).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(p.levels.filter((l) => l.hasContent).map((l) => l.level)).toEqual(['A1', 'A2']);
  });
});

describe('statusCounts', () => {
  it('splits words and sentences into new / learning / consolidated', () => {
    const cards = freshCards().map((c) => {
      if (c.id === cardId.recognize('w_bok')) return review(c, 30); // consolidated
      if (c.id === cardId.recognize('w_da')) return review(c, 5); // learning (review, but short)
      if (c.id === cardId.recognize('w_hvala')) return { ...c, state: CardState.Learning };
      if (c.id === cardId.cloze('s_kavu')) return review(c, 40);
      return c;
    });
    const s = statusCounts(cards);
    expect(s.words).toEqual({ neu: 17, lernen: 2, gefestigt: 1 });
    expect(s.sentences).toEqual({ neu: 10, lernen: 0, gefestigt: 1 });
  });

  it('cardStatus thresholds', () => {
    expect(cardStatus({ state: CardState.Relearning, stability: 100 })).toBe('lernen');
    expect(cardStatus({ state: CardState.Review, stability: 21 })).toBe('gefestigt');
  });
});

describe('calendar & streak', () => {
  const now = new Date('2026-11-20T10:00:00').getTime(); // Friday
  const days = (offsets: number[]) => new Set(offsets.map((o) => dayKey(now - o * DAY)));

  it('current streak includes today when learned today', () => {
    expect(streaks(days([0, 1, 2, 4]), now)).toEqual({ current: 3, longest: 3, today: true });
  });

  it('streak is not lost in the morning before learning', () => {
    expect(streaks(days([1, 2]), now).current).toBe(2);
    expect(streaks(days([2, 3]), now).current).toBe(0);
  });

  it('longest streak over the whole history', () => {
    expect(streaks(days([0, 10, 11, 12, 13, 14]), now).longest).toBe(5);
  });

  it('heat bins', () => {
    expect([0, 1, 9, 10, 24, 25, 49, 50, 200].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('grid: weeks × 7, Monday first, today in the last column, future marked', () => {
    const act = activityByDay([{ day: dayKey(now) }, { day: dayKey(now) }, { day: dayKey(now - DAY) }]);
    const grid = calendarGrid(act, 4, now);
    expect(grid).toHaveLength(4);
    expect(grid.every((col) => col.length === 7)).toBe(true);
    expect(new Date(`${grid[0]![0]!.day}T12:00:00`).getDay()).toBe(1); // Monday
    const last = grid[3]!;
    expect(last[4]).toMatchObject({ day: dayKey(now), count: 2, level: 1, future: false }); // Friday
    expect(last[5]!.future).toBe(true);
    expect(last[3]!.count).toBe(1);
  });
});

describe('accuracyByWeek', () => {
  const now = new Date('2026-11-20T10:00:00').getTime();
  const kinds: Record<string, CardRecord['kind']> = { a: 'recognize', b: 'produce', c: 'cloze' };

  it('separates understanding (HR→DE) from speaking (DE→HR + cloze) and skips multiple choice', () => {
    const logs = [
      log('a', now, Rating.Good),
      log('a', now, Rating.Again),
      log('b', now, Rating.Hard),
      log('c', now, Rating.Again),
      log('c', now, Rating.Good, { wasMultipleChoice: true }),
      log('a', now - 7 * DAY, Rating.Good),
    ];
    const pts = accuracyByWeek(logs, (id) => kinds[id], 3, now);
    expect(pts).toHaveLength(3);
    expect(pts[2]).toMatchObject({ verstehen: { n: 2, rate: 0.5 }, sprechen: { n: 2, rate: 0.5 } });
    expect(pts[1]).toMatchObject({ verstehen: { n: 1, rate: 1 }, sprechen: null });
    expect(pts[0]).toMatchObject({ verstehen: null, sprechen: null });
  });
});

describe('dueForecast', () => {
  it('counts due reviews per day; overdue lands on today; new cards ignored', () => {
    const [a, b, c, d, e] = freshCards();
    const cards = [review(a!, 5, { due: T0 - 3 * DAY }), review(b!, 5, { due: T0 + 1 * DAY }), review(c!, 5, { due: T0 + 1 * DAY + 1000 }), review(d!, 5, { due: T0 + 30 * DAY }), e!];
    const f = dueForecast(cards, 7, T0);
    expect(f).toHaveLength(7);
    expect(f.map((x) => x.count)).toEqual([1, 2, 0, 0, 0, 0, 0]);
  });
});

describe('weakSpots & focus practice', () => {
  const now = T0;
  const cards = freshCards().map((c) => (c.kind !== 'produce' ? review(c, 5, { lapses: c.wordId === 'w_kava' ? 3 : 0 }) : c));
  const logs = [
    log(cardId.recognize('w_kava'), now - DAY, Rating.Again),
    log(cardId.recognize('w_kava'), now - DAY, Rating.Again),
    log(cardId.cloze('s_kavu'), now - DAY, Rating.Again),
    log(cardId.recognize('w_bok'), now - DAY, Rating.Good),
    log(cardId.recognize('w_bok'), now - DAY, Rating.Again),
    log(cardId.recognize('w_caj'), now - 100 * DAY, Rating.Again), // too old
  ];
  const withGrammar = { ...sampleContent, sentenceById: new Map(sampleContent.sentenceById) };
  withGrammar.sentenceById.set('s_kavu', { ...sampleContent.sentenceById.get('s_kavu')!, grammarId: 'g_test' });
  const grammarById = new Map([['g_test', { id: 'g_test', title: 'Akkusativ', summary: '' }]]);

  it('ranks words, grammar and units by mistakes within the window', () => {
    const w = weakSpots(logs, cards, { ...withGrammar, grammarById }, now);
    expect(w.words.map((x) => x.label)).toEqual(['kava', 'bok']);
    expect(w.words[0]).toMatchObject({ errors: 3, attempts: 3, errorRate: 1 });
    expect(w.grammar).toEqual([]); // only one attempt (< 2)
    expect(w.units[0]!.id).toBe('u02_kafic');
    expect(w.words.map((x) => x.id)).not.toContain('w_caj');
  });

  it('focus practice: only seen cards of the target, shakiest first', () => {
    const f = focusCards({ type: 'word', id: 'w_kava' }, cards, withGrammar, undefined, 20, seededRng(1));
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((c) => c.wordId === 'w_kava' && c.state !== CardState.New)).toBe(true);
    const unit = focusCards({ type: 'unit', id: 'u01_pozdravi' }, cards, withGrammar, undefined, 3, seededRng(1));
    expect(unit).toHaveLength(3);
  });

  it('focus on all weak spots combines words and grammar', () => {
    const w = weakSpots(logs, cards, { ...withGrammar, grammarById }, now);
    const f = focusCards({ type: 'weak' }, cards, withGrammar, w, 20, seededRng(2));
    expect(new Set(f.map((c) => c.wordId))).toEqual(new Set(['w_kava', 'w_bok']));
  });
});

describe('backup (export / import)', () => {
  it('round-trips progress, history and settings', async () => {
    const a = new PricajDB(`bk-a-${Math.random()}`);
    await syncCards(a, sampleContent.cardDefs, T0);
    const sched = createScheduler({ fuzz: false });
    await recordReview(a, cardId.recognize('w_kava'), Rating.Good, { wasMultipleChoice: false, durationMs: 1 }, T0, sched);
    await updateSettings(a, { newCardsPerDay: 17 });
    const backup = JSON.parse(JSON.stringify(await createBackup(a, new Date(T0))));

    const b = new PricajDB(`bk-b-${Math.random()}`);
    await syncCards(b, sampleContent.cardDefs, T0);
    const summary = await restoreBackup(b, parseBackup(backup), sampleContent.cardDefs);
    expect(summary.reviews).toBe(1);
    expect((await b.cards.get(cardId.recognize('w_kava')))!.reps).toBe(1);
    expect(await b.reviewLogs.count()).toBe(1);
    expect((await getSettings(b)).newCardsPerDay).toBe(17);
    await a.delete();
    await b.delete();
  });

  it('adds cards for content that is newer than the backup', async () => {
    const db = new PricajDB(`bk-c-${Math.random()}`);
    const old = { app: 'pricaj', format: 1, exportedAt: '', contentVersion: 1, cards: [], reviewLogs: [], settings: [], meta: [] };
    await restoreBackup(db, parseBackup(old), sampleContent.cardDefs);
    expect(await db.cards.count()).toBe(sampleContent.cardDefs.length);
    await db.delete();
  });

  it.each([
    [null, 'keine Pričaj!'],
    [{ app: 'other' }, 'keine Pričaj!'],
    [{ app: 'pricaj', format: 99, cards: [], reviewLogs: [], settings: [], meta: [] }, 'neueren Version'],
    [{ app: 'pricaj', format: 1, cards: [] }, 'unvollständig'],
    [{ app: 'pricaj', format: 1, cards: [{ id: 1 }], reviewLogs: [], settings: [], meta: [] }, 'Karten'],
  ])('rejects invalid files with a German message (%#)', (raw, msg) => {
    expect(() => parseBackup(raw)).toThrow(BackupError);
    expect(() => parseBackup(raw)).toThrow(msg);
  });

  it('file name contains the date', () => {
    expect(backupFileName(new Date('2026-11-21T08:00:00Z'))).toBe('pricaj-backup-2026-11-21.json');
  });
});
