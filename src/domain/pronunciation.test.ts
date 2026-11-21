import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { pronunciation } from '../content/pronunciation';
import { PricajDB } from '../db/db';
import { getPronunciationProgress, markPronunciationPractised } from '../db/repo';
import { seededRng } from '../lib/random';
import {
  blankLetter,
  EMPTY_PRON_PROGRESS,
  fillBlank,
  isPronunciationComplete,
  mixedQuiz,
  pairQuiz,
  soundQuiz,
} from './pronunciation';

const { sounds, pairs, intro } = pronunciation;

describe('pronunciation content', () => {
  it('covers every special sound in the planned order', () => {
    expect(sounds.map((s) => s.letter)).toEqual(['c', 'č', 'ć', 'š', 'ž', 'dž', 'đ', 'lj', 'nj', 'r', 'j', 'h']);
  });

  it.each(sounds.map((s) => [s.letter, s] as const))('%s: explanation, German comparison, examples, exercise', (_l, s) => {
    expect(s.explanation.length).toBeGreaterThan(20);
    expect(s.compare.word).toBeTruthy();
    expect(s.compare.hint).toContain(s.compare.word);
    expect(s.examples.length).toBeGreaterThanOrEqual(3);
    for (const e of s.examples) expect(e.hr.toLowerCase()).toContain(s.letter);
    // the correct letter is an option, options are unique
    expect(s.options).toContain(s.letter);
    expect(new Set(s.options).size).toBe(s.options.length);
    expect(s.options.length).toBeGreaterThanOrEqual(3);
    expect(s.items.length).toBeGreaterThanOrEqual(3);
    for (const it of s.items) {
      expect(it.blank.split('_')).toHaveLength(2); // exactly one gap
      expect(fillBlank(it.blank, s.letter)).toBe(it.word);
      expect(it.de).toBeTruthy();
    }
  });

  it('no exercise word is ambiguous: a wrong option never forms the same word', () => {
    for (const s of sounds)
      for (const it of s.items)
        for (const o of s.options) if (o !== s.letter) expect(fillBlank(it.blank, o)).not.toBe(it.word);
  });

  it('r as a vowel: in every r-word the r stands between two consonants', () => {
    const r = sounds.find((s) => s.id === 'r')!;
    for (const it of r.items) {
      const i = it.blank.indexOf('_');
      expect(it.blank[i - 1], it.word).toMatch(/[^aeiou]/);
      expect(it.blank[i + 1], it.word).toMatch(/[^aeiou]/);
    }
  });

  it('has the two hard pairs č/ć and dž/đ with the requested example words', () => {
    expect(pairs.map((p) => [p.left.letter, p.right.letter])).toEqual([
      ['č', 'ć'],
      ['dž', 'đ'],
    ]);
    const words = pairs.flatMap((p) => [...p.left.words, ...p.right.words].map((w) => w.hr));
    for (const w of ['čaj', 'ćevapi', 'džep', 'đak']) expect(words).toContain(w);
    for (const p of pairs) {
      expect(p.left.label).toBe('hart');
      expect(p.right.label).toBe('weich');
      for (const side of [p.left, p.right]) for (const w of side.words) expect(w.hr).toContain(side.letter);
      // the other letter of the pair must not appear (otherwise the gap would be ambiguous)
      for (const w of p.left.words) expect(w.hr).not.toContain(p.right.letter);
      for (const w of p.right.words) expect(w.hr).not.toContain(p.left.letter);
    }
  });

  it('explains spelling and stress', () => {
    expect(intro.spelling.body.join(' ')).toMatch(/wie es geschrieben wird/);
    expect(intro.stress.body.join(' ')).toMatch(/letzten Silbe/);
    for (const e of intro.stress.examples) {
      expect(e.syllables.join('')).toBe(e.hr);
      expect(e.stressed).toBeLessThan(e.syllables.length - 1); // never the last syllable
    }
  });
});

describe('pronunciation exercises', () => {
  it('soundQuiz: one question per item, answer among shuffled options', () => {
    const s = sounds[1]!;
    const q = soundQuiz(s, seededRng(1));
    expect(q).toHaveLength(s.items.length);
    for (const x of q) {
      expect(x.answer).toBe('č');
      expect([...x.options].sort()).toEqual([...s.options].sort());
      expect(fillBlank(x.blank, x.answer)).toBe(x.word);
    }
  });

  it('pairQuiz: all 8 words, blank at the right letter, two options', () => {
    const q = pairQuiz(pairs[1]!, seededRng(2));
    expect(q).toHaveLength(8);
    for (const x of q) {
      expect(x.options).toEqual(['dž', 'đ']);
      expect(fillBlank(x.blank, x.answer)).toBe(x.word);
    }
  });

  it('blankLetter handles digraphs', () => {
    expect(blankLetter('patlidžan', 'dž')).toBe('patli_an');
    expect(blankLetter('rođendan', 'đ')).toBe('ro_endan');
  });

  it('mixedQuiz: exactly one word per sound', () => {
    const q = mixedQuiz(sounds, seededRng(3));
    expect(q).toHaveLength(sounds.length);
    expect(new Set(q.map((x) => x.groupId)).size).toBe(sounds.length);
  });

  it('lesson is complete when all sounds and pairs are practised', () => {
    const all = { practised: sounds.map((s) => s.id), pairs: pairs.map((p) => p.id) };
    expect(isPronunciationComplete(EMPTY_PRON_PROGRESS, sounds, pairs)).toBe(false);
    expect(isPronunciationComplete({ ...all, pairs: [] }, sounds, pairs)).toBe(false);
    expect(isPronunciationComplete(all, sounds, pairs)).toBe(true);
    expect(isPronunciationComplete({ practised: [], pairs: [], completedAt: 1 }, sounds, pairs)).toBe(true);
  });
});

describe('pronunciation progress (IndexedDB)', () => {
  it('records practised sounds idempotently and the completion time', async () => {
    const db = new PricajDB(`pron-${Math.random()}`);
    expect(await getPronunciationProgress(db)).toEqual(EMPTY_PRON_PROGRESS);
    await markPronunciationPractised(db, { sound: 'č' });
    await markPronunciationPractised(db, { sound: 'č' });
    await markPronunciationPractised(db, { pair: 'č-ć' });
    let p = await getPronunciationProgress(db);
    expect(p.practised).toEqual(['č']);
    expect(p.pairs).toEqual(['č-ć']);
    expect(p.completedAt).toBeUndefined();
    await markPronunciationPractised(db, { complete: true }, 1234);
    p = await getPronunciationProgress(db);
    expect(p.completedAt).toBe(1234);
    await db.delete();
  });
});
