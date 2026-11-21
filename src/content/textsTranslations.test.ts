import { describe, expect, it } from 'vitest';
import { buildExercise, exerciseMode } from '../domain/exercise';
import { checkDialogueAnswer } from '../domain/dialogue';
import { isUnlocked } from '../domain/unlock';
import { CardState } from '../domain/types';
import { analyzeSentence, buildFormIndex, tokenize } from './analyze';
import { buildContent, cardId } from './build';
import { sampleFiles } from './fixtures/sample';
import { content } from './index';
import names from './names.json';
import { foldDiacritics, normalize } from '../domain/answerCheck';

// Fixture: the 20 sample words plus one text and one free translation.
const fx = buildContent(
  [
    ...sampleFiles.slice(0, 3),
    {
      ...sampleFiles[3]!,
      texts: [
        {
          id: 't_test',
          title: 'Kava',
          hr: 'Moja majka pije kavu.\n\nBrat pije čaj.',
          de: 'Meine Mutter trinkt Kaffee.\n\nDer Bruder trinkt Tee.',
          glossary: [{ hr: 'moja', de: 'meine' }],
          questions: [{ q: 'Was trinkt der Bruder?', options: ['Kaffee', 'Tee'], answer: 1 }],
        },
      ],
      translations: [{ id: 'tr_test', de: 'Ich trinke Tee.', hr: ['Pijem čaj.', 'Ja pijem čaj.'], keywords: [['pij'], ['čaj']] }],
    },
  ],
  ['Splitu', 'Njemačkoj'],
);

describe('free translation cards', () => {
  const def = fx.cardDefs.find((d) => d.kind === 'translate')!;

  it('one card per translation, waiting until all its words were seen', () => {
    expect(def.id).toBe(cardId.translate('tr_test'));
    expect(def.requiresSeen).toEqual(expect.arrayContaining([cardId.recognize('w_caj'), cardId.recognize('w_piti')]));
    expect(isUnlocked(def, () => ({ state: CardState.New }) as never)).toBe(false);
    expect(isUnlocked(def, () => ({ state: CardState.Review }) as never)).toBe(true);
  });

  it('is always typed (no multiple choice) and expects the model translations', () => {
    const ex = buildExercise(def, { state: CardState.New }, fx);
    expect(ex.mode).toBe('type');
    expect(exerciseMode({ state: CardState.New, kind: 'translate' })).toBe('type');
    expect(ex.prompt).toBe('Ich trinke Tee.');
    expect(ex.expected).toEqual(['Pijem čaj.', 'Ja pijem čaj.']);
  });

  it('free wording with the key words is understood', () => {
    const t = fx.translationById.get('tr_test')!;
    const turn = { speaker: 'user' as const, task: '', answers: t.hr, keywords: t.keywords };
    expect(checkDialogueAnswer('pijem čaj', turn).verdict).toBe('perfect');
    expect(checkDialogueAnswer('Sada pijem jedan čaj', turn).verdict).toBe('good');
    expect(checkDialogueAnswer('Pijem kavu', turn).verdict).toBe('partial');
  });
});

describe('reading texts', () => {
  it('are attached to their unit with glossary and questions', () => {
    const t = fx.textById.get('t_test')!;
    expect(t.unitId).toBe('u04_svakodnevica');
    expect(t.glossary).toHaveLength(1);
  });
});

// ───── Validation of the real course content (applies as soon as B2 texts/translations exist) ─────
const index = buildFormIndex(content.words);
const nameSet = new Set(names);
const unitOrder = new Map(content.units.map((u) => [u.id, u.order]));
const fold = (s: string) => foldDiacritics(normalize(s));

describe('course texts & translations', () => {
  it('texts: paragraphs match the translation, questions are valid, every word is known or in the glossary', () => {
    for (const t of content.texts) {
      expect(t.hr.split(/\n\s*\n/).length, t.id).toBe(t.de.split(/\n\s*\n/).length);
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(2);
      for (const q of t.questions) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
      const gloss = new Set(t.glossary.map((g) => fold(g.hr)));
      const max = unitOrder.get(t.unitId)! * 1000 + 999;
      const a = analyzeSentence(t.hr, index, nameSet);
      const unknown = a.unknown.filter((u) => !gloss.has(fold(u)));
      expect(unknown, `${t.id}: ${unknown.join(', ')}`).toEqual([]);
      const later = a.matches.map((m) => content.wordById.get(m.wordId)!).filter((w) => w.order > max).map((w) => w.hr);
      expect(later, `${t.id}: später gelernte Wörter`).toEqual([]);
      // glossary stays small: the text is mostly readable with course words
      expect(t.glossary.length / Math.max(1, tokenize(t.hr).length), t.id).toBeLessThanOrEqual(0.12);
    }
  });

  it('translations: model answers use known words, are perfect matches and contain the key words', () => {
    for (const tr of content.translations) {
      expect(tr.hr.length, tr.id).toBeGreaterThan(0);
      expect(tr.keywords.length, tr.id).toBeGreaterThan(0);
      const max = unitOrder.get(tr.unitId)! * 1000 + 999;
      for (const h of tr.hr) {
        const a = analyzeSentence(h, index, nameSet);
        expect(a.unknown, `${tr.id}: ${h}`).toEqual([]);
        for (const m of a.matches) expect(content.wordById.get(m.wordId)!.order, `${tr.id}: ${h}`).toBeLessThanOrEqual(max);
        expect(checkDialogueAnswer(h, { speaker: 'user', task: '', answers: tr.hr, keywords: tr.keywords }).verdict).toBe('perfect');
      }
    }
  });
});
