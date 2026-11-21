import { content, CONTENT_VERSION } from '../content';
import { createScheduler, newSchedulingState, type Scheduler } from '../domain/scheduler';
import {
  CardState,
  DEFAULT_SETTINGS,
  type AnswerVerdict,
  type CardDef,
  type CardRecord,
  type Rating,
  type ReviewLog,
  type Settings,
} from '../domain/types';
import { EMPTY_PRON_PROGRESS, type PronunciationProgress } from '../domain/pronunciation';
import { computeUnlockedUnits } from '../domain/units';
import { dayKey } from '../lib/date';
import type { PricajDB } from './db';

/**
 * Makes sure every card defined by the content exists in the DB.
 * Existing learning progress is never touched – only definition fields are updated.
 * Cards whose content was removed are deleted.
 */
export async function syncCards(db: PricajDB, defs: CardDef[] = content.cardDefs, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.cards, db.meta, async () => {
    const existing = new Map((await db.cards.toArray()).map((c) => [c.id, c]));
    const wanted = new Set(defs.map((d) => d.id));
    const toPut: CardRecord[] = [];
    for (const def of defs) {
      const cur = existing.get(def.id);
      if (!cur) {
        toPut.push({ ...def, ...newSchedulingState(now) });
      } else if (
        cur.order !== def.order ||
        cur.requires !== def.requires ||
        cur.unitId !== def.unitId ||
        cur.wordId !== def.wordId ||
        (cur.requiresSeen ?? []).join() !== (def.requiresSeen ?? []).join()
      ) {
        const { requiresSeen: _drop, ...rest } = cur;
        toPut.push({ ...rest, ...def });
      }
    }
    if (toPut.length) await db.cards.bulkPut(toPut);
    const orphans = [...existing.keys()].filter((id) => !wanted.has(id));
    if (orphans.length) await db.cards.bulkDelete(orphans);
    await db.meta.put({ key: 'contentVersion', value: CONTENT_VERSION });
  });
}

export async function getSettings(db: PricajDB): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) };
}

export async function updateSettings(db: PricajDB, patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = await getSettings(db);
  await db.settings.put({ ...cur, ...patch, id: 'settings' });
}

/** Number of distinct cards introduced (first reviewed while new) on the given day. */
export async function countNewIntroduced(db: PricajDB, day: string): Promise<number> {
  const logs = await db.reviewLogs.where('[day+stateBefore]').equals([day, CardState.New]).toArray();
  return new Set(logs.map((l) => l.cardId)).size;
}

export interface ReviewMeta {
  wasMultipleChoice: boolean;
  answer?: string;
  verdict?: AnswerVerdict;
  durationMs: number;
}

/** Applies a rating to a card (FSRS) and logs the review – atomically. */
export async function recordReview(
  db: PricajDB,
  cardId: string,
  rating: Rating,
  meta: ReviewMeta,
  now = Date.now(),
  scheduler: Scheduler = defaultScheduler,
): Promise<CardRecord> {
  return db.transaction('rw', db.cards, db.reviewLogs, async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    const next: CardRecord = { ...card, ...scheduler.review(card, rating, now) };
    await db.cards.put(next);
    const log: ReviewLog = {
      cardId,
      ts: now,
      day: dayKey(now),
      rating,
      stateBefore: card.state,
      wasMultipleChoice: meta.wasMultipleChoice,
      durationMs: Math.round(meta.durationMs),
    };
    if (meta.answer !== undefined) log.answer = meta.answer;
    if (meta.verdict !== undefined) log.verdict = meta.verdict;
    await db.reviewLogs.add(log);
    return next;
  });
}

export async function setSuspended(db: PricajDB, cardId: string, suspended: boolean): Promise<void> {
  await db.cards.update(cardId, { suspended });
}

/** Deletes all learning progress (cards are recreated as new). Settings are kept. */
export async function resetProgress(db: PricajDB, defs: CardDef[] = content.cardDefs, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.cards, db.reviewLogs, db.meta, async () => {
    await db.cards.clear();
    await db.reviewLogs.clear();
    await db.meta.delete(UNLOCKED_UNITS_KEY);
  });
  await syncCards(db, defs, now);
}

const UNLOCKED_UNITS_KEY = 'unlockedUnits';

export async function getStoredUnlockedUnits(db: PricajDB): Promise<string[]> {
  const entry = await db.meta.get(UNLOCKED_UNITS_KEY);
  return Array.isArray(entry?.value) ? (entry.value as string[]) : [];
}

/**
 * Computes which units are open (≥ 80 % of the previous unit mastered) and
 * persists them, so a unit never locks again. Returns the open units and the
 * ones that were unlocked just now.
 */
export async function refreshUnlockedUnits(
  db: PricajDB,
  units: readonly { id: string }[] = content.units,
): Promise<{ unlocked: Set<string>; newlyUnlocked: string[] }> {
  return db.transaction('rw', db.cards, db.meta, async () => {
    const [cards, stored] = await Promise.all([db.cards.toArray(), getStoredUnlockedUnits(db)]);
    const unlocked = computeUnlockedUnits(units, cards, stored);
    const before = new Set(stored);
    const newlyUnlocked = units.map((u) => u.id).filter((id) => unlocked.has(id) && !before.has(id));
    if (newlyUnlocked.length) await db.meta.put({ key: UNLOCKED_UNITS_KEY, value: units.map((u) => u.id).filter((id) => unlocked.has(id)) });
    return { unlocked, newlyUnlocked };
  });
}

export const defaultScheduler = createScheduler({ fuzz: true });

const PRON_KEY = 'pronunciation';

export async function getPronunciationProgress(db: PricajDB): Promise<PronunciationProgress> {
  const entry = await db.meta.get(PRON_KEY);
  const v = (entry?.value ?? {}) as Partial<PronunciationProgress>;
  return { ...EMPTY_PRON_PROGRESS, ...v, practised: v.practised ?? [], pairs: v.pairs ?? [] };
}

/** Records a finished sound or pair exercise (idempotent). */
export async function markPronunciationPractised(
  db: PricajDB,
  done: { sound?: string; pair?: string; complete?: boolean },
  now = Date.now(),
): Promise<PronunciationProgress> {
  return db.transaction('rw', db.meta, async () => {
    const cur = await getPronunciationProgress(db);
    const next: PronunciationProgress = {
      practised: done.sound && !cur.practised.includes(done.sound) ? [...cur.practised, done.sound] : cur.practised,
      pairs: done.pair && !cur.pairs.includes(done.pair) ? [...cur.pairs, done.pair] : cur.pairs,
      completedAt: cur.completedAt ?? (done.complete ? now : undefined),
    };
    if (next.completedAt === undefined) delete next.completedAt;
    await db.meta.put({ key: PRON_KEY, value: next });
    return next;
  });
}
