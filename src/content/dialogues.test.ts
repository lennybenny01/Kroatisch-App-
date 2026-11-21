import { describe, expect, it } from 'vitest';
import { checkDialogueAnswer, type UserTurn } from '../domain/dialogue';
import { analyzeSentence, buildFormIndex, tokenize } from './analyze';
import { dialogues } from './dialogues';
import { content } from './index';
import names from './names.json';

const index = buildFormIndex(content.words);
const nameSet = new Set(names);
const unitOrder = new Map(content.units.map((u) => [u.id, u.order]));

describe('dialogue scenarios', () => {
  it('every unit ends with a dialogue', () => {
    for (const u of content.units) expect(dialogues.some((d) => d.unitId === u.id), u.title).toBe(true);
  });

  it.each(dialogues.map((d) => [d.title, d] as const))('%s: structure', (_t, d) => {
    expect(d.setting.length).toBeGreaterThan(20);
    expect(d.turns[0]!.speaker).toBe('partner');
    const user = d.turns.filter((t): t is UserTurn => t.speaker === 'user');
    expect(user.length).toBeGreaterThanOrEqual(3);
    for (const t of d.turns) {
      if (t.speaker === 'partner') expect(t.de.trim()).not.toBe('');
      else {
        expect(t.task.trim()).not.toBe('');
        expect(t.answers.length).toBeGreaterThan(0);
        expect(t.keywords.length).toBeGreaterThan(0);
      }
    }
  });

  it('dialogues only use vocabulary learned up to their unit (no surprises)', () => {
    const problems: string[] = [];
    for (const d of dialogues) {
      const max = unitOrder.get(d.unitId)! * 1000 + 999;
      const texts = d.turns.flatMap((t) => (t.speaker === 'partner' ? [t.hr] : t.answers.map((a) => a.replace(/\*/g, ''))));
      for (const text of texts) {
        const a = analyzeSentence(text, index, nameSet);
        if (a.unknown.length) problems.push(`${d.id} „${text}“: unbekannt ${a.unknown.join(', ')}`);
        for (const m of a.matches) {
          const w = content.wordById.get(m.wordId)!;
          if (w.order > max) problems.push(`${d.id} „${text}“: „${w.hr}“ erst in ${w.unitId}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every model answer is recognised as perfect and contains all keywords', () => {
    for (const d of dialogues)
      for (const t of d.turns) {
        if (t.speaker !== 'user') continue;
        for (const a of t.answers) {
          const filled = a.replace(/\*/g, 'Ana');
          expect(checkDialogueAnswer(filled, t).verdict, `${d.id}: ${a}`).toBe('perfect');
        }
        // the keywords alone (without the exact wording) are understood
        const first = t.answers[0]!.replace(/\*/g, 'Ana');
        expect(checkDialogueAnswer(`${first} baš`, t).verdict, `${d.id} keywords: ${first}`).not.toBe('miss');
      }
  });

  it('no Serbian forms in dialogues', () => {
    const banned = ['šta', 'ko', 'hleb', 'kafa', 'mleko', 'da li', 'ovde', 'gde', 'sutradan'];
    for (const d of dialogues)
      for (const t of d.turns) {
        const texts = t.speaker === 'partner' ? [t.hr] : t.answers;
        for (const x of texts) for (const tok of tokenize(x)) expect(banned, x).not.toContain(tok.norm);
      }
  });
});

describe('checkDialogueAnswer', () => {
  const turn: UserTurn = {
    speaker: 'user',
    task: 'Bestelle einen Kaffee mit Milch.',
    answers: ['Jednu kavu s mlijekom, molim.', 'Kavu s mlijekom, molim.'],
    keywords: [['kav'], ['mlijek']],
  };
  it('model answers are perfect, tolerant to case, punctuation and missing háčeks', () => {
    expect(checkDialogueAnswer('kavu s mlijekom molim', turn).verdict).toBe('perfect');
    expect(checkDialogueAnswer('JEDNU KAVU S MLIJEKOM, MOLIM!', turn).verdict).toBe('perfect');
  });
  it('other wording with all keywords is understood (good)', () => {
    const r = checkDialogueAnswer('Može jedna kava s mlijekom?', turn);
    expect(r.verdict).toBe('good');
    expect(r.model).toBe('Jednu kavu s mlijekom, molim.');
  });
  it('some keywords → partial, with what is missing', () => {
    expect(checkDialogueAnswer('Jednu kavu, molim.', turn)).toMatchObject({ verdict: 'partial', missing: ['mlijek'] });
  });
  it('nothing relevant → miss; empty → miss', () => {
    expect(checkDialogueAnswer('Dobar dan', turn).verdict).toBe('miss');
    expect(checkDialogueAnswer('  ', turn).verdict).toBe('miss');
  });
  it('wildcards accept names and numbers', () => {
    const t: UserTurn = { speaker: 'user', task: '', answers: ['Zovem se *.'], keywords: [['zovem se']] };
    expect(checkDialogueAnswer('Zovem se Lena Maria', t).verdict).toBe('perfect');
    expect(checkDialogueAnswer('Ja sam Lena', t).verdict).toBe('miss');
    const age: UserTurn = { speaker: 'user', task: '', answers: ['Imam * godina.'], keywords: [['imam'], ['godin']] };
    expect(checkDialogueAnswer('Imam 35 godina', age).verdict).toBe('perfect');
  });
});
