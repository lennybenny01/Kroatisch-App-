import { content, CONTENT_VERSION } from '../content';
import { createScheduler, newSchedulingState, type Scheduler } from '../domain/scheduler';
import {
  CardState,
  CUSTOM_UNIT,
  DEFAULT_SETTINGS,
  type CustomWord,
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
    // Custom cards are not part of the course content – never treat them as orphans.
    const orphans = [...existing.values()].filter((c) => !wanted.has(c.id) && c.unitId !== CUSTOM_UNIT).map((c) => c.id);
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
  spoken?: boolean;
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
    if (meta.spoken) log.spoken = true;
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
  // Own cards stay – they start again as new.
  await db.transaction('rw', db.cards, db.customWords, async () => {
    for (const w of await db.customWords.toArray()) await db.cards.bulkPut(customCardsFor(w, now));
  });
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

const DIALOGUE_KEY = 'dialogues';

export interface DialogueResult {
  best: number;
  last: number;
  completedAt: number;
  times: number;
}

export async function getDialogueResults(db: PricajDB): Promise<Record<string, DialogueResult>> {
  const entry = await db.meta.get(DIALOGUE_KEY);
  return (entry?.value as Record<string, DialogueResult> | undefined) ?? {};
}

export async function saveDialogueResult(db: PricajDB, dialogueId: string, score: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const all = await getDialogueResults(db);
    const prev = all[dialogueId];
    all[dialogueId] = { best: Math.max(prev?.best ?? 0, score), last: score, completedAt: now, times: (prev?.times ?? 0) + 1 };
    await db.meta.put({ key: DIALOGUE_KEY, value: all });
  });
}

// ───────────── Own cards ─────────────

export type CustomWordInput = Omit<CustomWord, 'id' | 'createdAt'>;

/** Introduction order: own cards come before new course cards (they were added on purpose), oldest first. */
const customOrder = (createdAt: number) => createdAt / 1000 - 1e10;

/** Cards for an own word: HR→DE and (optionally) DE→HR, gated like course cards. */
export function customCardsFor(w: CustomWord, now = Date.now()): CardRecord[] {
  const base = { unitId: CUSTOM_UNIT, wordId: w.id, ...newSchedulingState(now) };
  const order = customOrder(w.createdAt);
  const cards: CardRecord[] = [{ ...base, id: `${w.id}:recognize`, kind: 'recognize', order }];
  if (w.practiceProduce) cards.push({ ...base, id: `${w.id}:produce`, kind: 'produce', order: order + 0.5, requires: `${w.id}:recognize` });
  return cards;
}

function cleanInput(input: CustomWordInput): CustomWordInput {
  // „sladoled; gelato“ → main answer + alternative
  const [main = '', ...inlineAlts] = input.hr.split(';').map((x) => x.trim()).filter(Boolean);
  const out: CustomWordInput = {
    hr: main,
    de: input.de.flatMap((d) => d.split(';')).map((d) => d.trim()).filter(Boolean),
    pos: input.pos,
    practiceProduce: input.practiceProduce,
  };
  const alts = [...inlineAlts, ...(input.hrAlt ?? [])].map((a) => a.trim()).filter(Boolean);
  if (alts.length) out.hrAlt = [...new Set(alts)];
  if (input.pos === 'noun' && input.gender) out.gender = input.gender;
  if (input.notes?.trim()) out.notes = input.notes.trim();
  if (input.example?.hr.trim()) out.example = { hr: input.example.hr.trim(), de: input.example.de.trim() };
  if (!out.hr) throw new Error('Bitte gib das kroatische Wort ein.');
  if (!out.de.length) throw new Error('Bitte gib mindestens eine deutsche Bedeutung ein.');
  return out;
}

export async function createCustomWord(db: PricajDB, input: CustomWordInput, now = Date.now()): Promise<CustomWord> {
  const word: CustomWord = { ...cleanInput(input), id: `cw_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: now };
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.add(word);
    await db.cards.bulkAdd(customCardsFor(word, now));
  });
  return word;
}

/** Updates an own word; learning progress is kept. Toggling DE→HR adds or removes that card. */
export async function updateCustomWord(db: PricajDB, id: string, input: CustomWordInput, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.customWords, db.cards, async () => {
    const cur = await db.customWords.get(id);
    if (!cur) throw new Error('Karte nicht gefunden.');
    const next: CustomWord = { ...cleanInput(input), id, createdAt: cur.createdAt };
    await db.customWords.put(next);
    const produceId = `${id}:produce`;
    const hasProduce = !!(await db.cards.get(produceId));
    if (next.practiceProduce && !hasProduce) await db.cards.put(customCardsFor(next, now)[1]!);
    if (!next.practiceProduce && hasProduce) await db.cards.delete(produceId);
  });
}

export async function deleteCustomWord(db: PricajDB, id: string): Promise<void> {
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.delete(id);
    await db.cards.where('wordId').equals(id).delete();
  });
}
