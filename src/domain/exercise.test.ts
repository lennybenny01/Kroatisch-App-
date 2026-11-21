import { describe, expect, it } from 'vitest';
import { buildCardDefs, cardId, sentenceById, sentences, wordById, words } from '../content';
import { seededRng } from '../lib/random';
import { BLANK, blankOut, buildExercise, exerciseMode } from './exercise';
import { CardState, type CardDef } from './types';

const content = { words, sentences, wordById, sentenceById };
const defs = new Map(buildCardDefs().map((d) => [d.id, d]));
const def = (id: string): CardDef => defs.get(id)!;

describe('exerciseMode', () => {
  it('multiple choice only on the very first contact', () => {
    expect(exerciseMode({ state: CardState.New })).toBe('choice');
    expect(exerciseMode({ state: CardState.Learning })).toBe('type');
    expect(exerciseMode({ state: CardState.Review })).toBe('type');
    expect(exerciseMode({ state: CardState.Relearning })).toBe('type');
  });
});

describe('buildExercise', () => {
  it('recognize: HR prompt, German answers', () => {
    const ex = buildExercise(def(cardId.recognize('w_kava')), { state: CardState.Review }, content);
    expect(ex.prompt).toBe('kava');
    expect(ex.answerLang).toBe('de');
    expect(ex.expected).toEqual(['Kaffee']);
    expect(ex.mode).toBe('type');
    expect(ex.choices).toBeUndefined();
  });

  it('produce: German prompt, Croatian answers incl. alternatives', () => {
    const ex = buildExercise(def(cardId.produce('w_majka')), { state: CardState.Review }, content);
    expect(ex.prompt).toBe('Mutter');
    expect(ex.answerLang).toBe('hr');
    expect(ex.expected).toEqual(['majka', 'mama']);
  });

  it('cloze: sentence with a blank, inflected form expected, lemma known', () => {
    const ex = buildExercise(def(cardId.cloze('s_kavu')), { state: CardState.Review }, content);
    expect(ex.prompt).toBe(`Molim jednu ${BLANK}.`);
    expect(ex.hint).toBe('Einen Kaffee, bitte.');
    expect(ex.expected).toEqual(['kavu']);
    expect(ex.lemma).toBe('kava');
  });

  it('new card → 4 unique choices including the correct one', () => {
    for (let seed = 0; seed < 10; seed++) {
      for (const d of defs.values()) {
        const ex = buildExercise(d, { state: CardState.New }, content, seededRng(seed));
        expect(ex.mode).toBe('choice');
        const lower = ex.choices!.map((c) => c.toLowerCase());
        expect(new Set(lower).size).toBe(ex.choices!.length);
        expect(ex.choices!.length).toBeGreaterThanOrEqual(3);
        expect(lower).toContain(ex.expected[0]!.toLowerCase());
      }
    }
  });

  it('cloze choices contain the dictionary form as distractor', () => {
    const ex = buildExercise(def(cardId.cloze('s_kavu')), { state: CardState.New }, content, seededRng(1));
    expect(ex.choices).toContain('kava');
    expect(ex.choices).toContain('kavu');
  });

  it('cloze choices at sentence start share capitalisation', () => {
    const ex = buildExercise(def(cardId.cloze('s_govorim')), { state: CardState.New }, content, seededRng(4));
    for (const c of ex.choices!) expect(c[0]).toBe(c[0]!.toUpperCase());
  });

  it('every cloze form actually occurs in its sentence', () => {
    for (const s of sentences) expect(blankOut(s.hr, s.clozeForm)).toContain(BLANK);
  });
});
