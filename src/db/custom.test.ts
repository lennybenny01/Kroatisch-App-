import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { content } from '../content';
import { sampleContent } from '../content/fixtures/sample';
import { buildLookup } from '../content/lookup';
import { buildExercise } from '../domain/exercise';
import { createScheduler } from '../domain/scheduler';
import { buildSession } from '../domain/session';
import { CardState, CUSTOM_UNIT, Rating } from '../domain/types';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { PricajDB } from './db';
import { createCustomWord, deleteCustomWord, recordReview, resetProgress, syncCards, updateCustomWord, type CustomWordInput } from './repo';

const T0 = new Date('2026-11-02T09:00:00').getTime();
const input: CustomWordInput = { hr: 'sladoled; gelato', de: ['Eis'], pos: 'noun', gender: 'm', practiceProduce: true, notes: ' bei Oma ' };
let db: PricajDB;

beforeEach(async () => {
  db = new PricajDB(`custom-${Math.random()}`);
  await syncCards(db, sampleContent.cardDefs, T0);
});
afterEach(async () => {
  await db.delete();
});

describe('own cards', () => {
  it('creates the word plus HR→DE and DE→HR cards (DE→HR gated)', async () => {
    const w = await createCustomWord(db, { ...input, hr: 'sladoled' }, T0);
    expect(w.notes).toBe('bei Oma');
    const cards = await db.cards.where('wordId').equals(w.id).toArray();
    expect(cards.map((c) => c.kind).sort()).toEqual(['produce', 'recognize']);
    expect(cards.every((c) => c.unitId === CUSTOM_UNIT && c.state === CardState.New)).toBe(true);
    expect(cards.find((c) => c.kind === 'produce')!.requires).toBe(`${w.id}:recognize`);
  });

  it('validates required fields with German messages', async () => {
    await expect(createCustomWord(db, { ...input, hr: '  ' })).rejects.toThrow('kroatische Wort');
    await expect(createCustomWord(db, { ...input, de: [' '] })).rejects.toThrow('deutsche Bedeutung');
  });

  it('editing keeps learning progress; switching off DE→HR removes that card', async () => {
    const w = await createCustomWord(db, input, T0);
    await recordReview(db, `${w.id}:recognize`, Rating.Good, { wasMultipleChoice: true, durationMs: 1 }, T0, createScheduler({ fuzz: false }));
    await updateCustomWord(db, w.id, { ...input, hr: 'sladoled', de: ['Eis', 'Speiseeis'], practiceProduce: false });
    expect((await db.customWords.get(w.id))!.de).toEqual(['Eis', 'Speiseeis']);
    expect((await db.cards.get(`${w.id}:recognize`))!.reps).toBe(1);
    expect(await db.cards.get(`${w.id}:produce`)).toBeUndefined();
    await updateCustomWord(db, w.id, { ...input, practiceProduce: true });
    expect(await db.cards.get(`${w.id}:produce`)).toBeDefined();
  });

  it('delete removes word and cards', async () => {
    const w = await createCustomWord(db, input, T0);
    await deleteCustomWord(db, w.id);
    expect(await db.customWords.count()).toBe(0);
    expect(await db.cards.where('wordId').equals(w.id).count()).toBe(0);
  });

  it('survive content sync and come back as new after a reset', async () => {
    const w = await createCustomWord(db, input, T0);
    await syncCards(db, sampleContent.cardDefs, T0);
    expect(await db.cards.get(`${w.id}:recognize`)).toBeDefined();
    await recordReview(db, `${w.id}:recognize`, Rating.Good, { wasMultipleChoice: true, durationMs: 1 }, T0);
    await resetProgress(db, sampleContent.cardDefs, T0);
    const c = await db.cards.get(`${w.id}:recognize`);
    expect(c?.state).toBe(CardState.New);
    expect(await db.customWords.count()).toBe(1);
  });

  it('are introduced before new course cards', async () => {
    const w = await createCustomWord(db, input, T0);
    const cards = await db.cards.toArray();
    const plan = buildSession({ cards, now: T0, newLimit: 3, newIntroducedToday: 0, unlockedUnits: new Set(['u01_pozdravi', CUSTOM_UNIT]) });
    expect(plan.queue).toContain(`${w.id}:recognize`);
    expect(plan.queue).not.toContain(`${w.id}:produce`); // gated
  });

  it('exercises work with the merged lookup (alternatives accepted, choices built)', async () => {
    const w = await createCustomWord(db, input, T0);
    const lookup = buildLookup(content, [w]);
    const card = (await db.cards.get(`${w.id}:produce`))!;
    const ex = buildExercise(card, { state: CardState.Review }, lookup);
    expect(ex.expected).toEqual(['sladoled', 'gelato']);
    expect(ex.prompt).toBe('Eis');
    const first = buildExercise((await db.cards.get(`${w.id}:recognize`))!, { state: CardState.New }, lookup);
    expect(first.choices).toContain('Eis');
  });

  it('are included in backups', async () => {
    const w = await createCustomWord(db, input, T0);
    const backup = JSON.parse(JSON.stringify(await createBackup(db)));
    const other = new PricajDB(`custom-b-${Math.random()}`);
    await restoreBackup(other, parseBackup(backup), sampleContent.cardDefs);
    expect((await other.customWords.get(w.id))!.hr).toBe('sladoled');
    expect(await other.cards.get(`${w.id}:recognize`)).toBeDefined();
    await other.delete();
  });
});
