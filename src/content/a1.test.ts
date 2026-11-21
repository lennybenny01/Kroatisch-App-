import { describe, expect, it } from 'vitest';
import { analyzeSentence, buildFormIndex, tokenize } from './analyze';
import { a1Files, content } from './index';
import names from './names.json';

const { units, words, sentences, wordById, grammarById } = content;

/** Serbian / ekavian forms that must not appear in standard Croatian content. */
const NOT_CROATIAN = [
  'šta', 'ko', 'hleb', 'mleko', 'lekar', 'voz', 'hiljada', 'hiljadu', 'porodica', 'kafa', 'supa', 'krompir', 'pirinač',
  'šolja', 'uvek', 'gde', 'ovde', 'deca', 'dete', 'vreme', 'lep', 'lepa', 'lepo', 'devojka', 'čovek', 'nedelja', 'sreda',
  'apoteka', 'aerodrom', 'ostrvo', 'juče', 'uveče', 'peške', 'levo', 'sedmica', 'razumem', 'živeti', 'hteo', 'htela',
  'mesec', 'deda', 'tačno', 'uopšte', 'testenina', 'pozorište', 'fudbal', 'pantalone', 'opština', 'hiljade',
];

const allCroatianTexts = () => [
  ...words.flatMap((w) => [w.hr, ...(w.hrAlt ?? []), ...(w.forms ?? []), w.example?.hr ?? '']),
  ...sentences.map((s) => s.hr),
  ...content.grammar.flatMap((g) => g.examples?.map((e) => e.hr) ?? []),
];

describe('A1 content: structure', () => {
  it('has 7 units in the planned order', () => {
    expect(units.map((u) => u.title)).toEqual([
      'Begrüßung',
      'Ich und du',
      'Zahlen, Uhrzeit, Tage',
      'Essen & Trinken',
      'Familie & Menschen',
      'Wichtige Verben',
      'Orte & Richtungen',
    ]);
    expect(units.map((u) => u.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(units.every((u) => u.level === 'A1')).toBe(true);
  });

  it('has about 300 words and 150 sentences', () => {
    expect(words.length).toBeGreaterThanOrEqual(280);
    expect(words.length).toBeLessThanOrEqual(340);
    expect(sentences.length).toBeGreaterThanOrEqual(140);
    expect(sentences.length).toBeLessThanOrEqual(180);
    // every file's sentences survived analysis
    expect(sentences.length).toBe(a1Files.reduce((n, f) => n + f.sentences.length, 0));
  });

  it('ids are unique across all files', () => {
    const ids = [...words.map((w) => w.id), ...sentences.map((s) => s.id), ...content.grammar.map((g) => g.id), ...units.map((u) => u.id)];
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it('no Croatian lemma appears twice', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const w of words) {
      const k = w.hr.toLowerCase();
      if (seen.has(k)) dupes.push(`${w.hr} (${seen.get(k)} / ${w.id})`);
      seen.set(k, w.id);
    }
    expect(dupes).toEqual([]);
  });
});

describe('A1 content: every card is complete', () => {
  it.each(words.map((w) => [w.id, w] as const))('%s', (_id, w) => {
    expect(w.hr.trim()).not.toBe('');
    expect(w.de.length).toBeGreaterThan(0);
    expect(w.de.every((d) => d.trim().length > 0)).toBe(true);
    expect(w.pos).toBeTruthy();
    if (w.pos === 'noun') expect(['m', 'f', 'n']).toContain(w.gender);
    if (w.pos === 'verb') {
      expect(['impf', 'pf', 'both']).toContain(w.aspect);
      // partner given, or explicitly null (no partner)
      expect(w.aspectPartner === null || (typeof w.aspectPartner === 'string' && w.aspectPartner.length > 0)).toBe(true);
    }
    // example sentence: inline or one of the practice sentences
    const practice = sentences.find((s) => s.clozeWordId === w.id);
    expect(w.example ?? practice, `${w.hr} needs an example`).toBeTruthy();
    if (w.example) expect(w.example.de.trim()).not.toBe('');
  });
});

describe('A1 content: sentences (i+1)', () => {
  it('every token of every sentence is course vocabulary or a name', () => {
    const problems = sentences
      .map((s) => ({ s: s.hr, unknown: content.analysis.get(s.id)!.unknown }))
      .filter((x) => x.unknown.length);
    expect(problems).toEqual([]);
  });

  it('the cloze word is the newest word of the sentence and belongs to the sentence’s unit', () => {
    const problems: string[] = [];
    for (const s of sentences) {
      const cloze = wordById.get(s.clozeWordId)!;
      if (cloze.unitId !== s.unitId) problems.push(`${s.id} „${s.hr}“: newest word „${cloze.hr}“ is from ${cloze.unitId}`);
      for (const id of s.wordIds) {
        if (id !== cloze.id && wordById.get(id)!.order > cloze.order) problems.push(`${s.id}: ${id} newer than cloze`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every sentence contains at most one new word (i+1)', () => {
    // Known before the sentence = all words introduced earlier than its newest word.
    for (const s of sentences) {
      const newest = wordById.get(s.clozeWordId)!.order;
      const newWords = s.wordIds.filter((id) => wordById.get(id)!.order >= newest);
      expect(newWords, s.hr).toHaveLength(1);
    }
  });

  it('cloze form sits at the stored position and blanks a whole word', () => {
    for (const s of sentences) {
      expect(s.hr.slice(s.clozeStart, s.clozeStart + s.clozeForm.length)).toBe(s.clozeForm);
      const before = s.hr[s.clozeStart - 1] ?? ' ';
      const after = s.hr[s.clozeStart + s.clozeForm.length] ?? ' ';
      expect(/\p{L}/u.test(before) || /\p{L}/u.test(after), s.hr).toBe(false);
    }
  });

  it('blanks „do“, not the „do“ inside „doći“', () => {
    const s = sentences.find((x) => x.hr === 'Kako mogu doći do kolodvora?')!;
    expect(s.hr.slice(0, s.clozeStart)).toBe('Kako mogu doći ');
  });

  it('each sentence practises a different word', () => {
    const counts = new Map<string, number>();
    for (const s of sentences) counts.set(s.clozeWordId, (counts.get(s.clozeWordId) ?? 0) + 1);
    const repeated = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
    expect(repeated).toEqual([]);
  });

  it('sentences have a German translation and are short', () => {
    for (const s of sentences) {
      expect(s.de.trim()).not.toBe('');
      expect(tokenize(s.hr).length).toBeLessThanOrEqual(10);
    }
  });

  it('grammar references resolve and every grammar topic is used or listed in a unit', () => {
    for (const s of sentences) if (s.grammarId) expect(grammarById.has(s.grammarId), `${s.id} → ${s.grammarId}`).toBe(true);
    for (const g of content.grammar) {
      expect(g.title).toBeTruthy();
      expect(g.summary).toBeTruthy();
      expect((g.body?.length ?? 0) + (g.table?.rows.length ?? 0) + (g.examples?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('Akkusativ and Lokativ are introduced through example sentences', () => {
    const uses = (gid: string) => sentences.filter((s) => s.grammarId === gid).length;
    expect(uses('g_akkusativ')).toBeGreaterThanOrEqual(5);
    expect(uses('g_lokativ')).toBeGreaterThanOrEqual(3);
  });
});

describe('A1 content: standard Croatian, ijekavian', () => {
  it('contains no Serbian or ekavian forms', () => {
    const hits: string[] = [];
    for (const text of allCroatianTexts()) {
      for (const t of tokenize(text)) if (NOT_CROATIAN.includes(t.norm)) hits.push(`${t.text} in „${text}“`);
      if (/\bda li\b/i.test(text)) hits.push(`„da li“ in „${text}“`);
      if (/\bhoću da\b/i.test(text)) hits.push(`„hoću da“ in „${text}“`);
    }
    expect(hits).toEqual([]);
  });

  it('uses ijekavian forms (mlijeko, vrijeme, dijete …)', () => {
    for (const hr of ['mlijeko', 'vrijeme', 'dijete', 'lijep', 'uvijek', 'čovjek', 'srijeda', 'nedjelja', 'lijevo']) {
      expect(words.some((w) => w.hr === hr), hr).toBe(true);
    }
  });

  it('inline examples only use course words, names, or explicitly allowed extras', () => {
    // Examples may preview a few forms not yet taught as cards.
    const ALLOWED_EXTRA = new Set(['bio', 'ovoj', 'jednu']);
    const index = buildFormIndex(words);
    const nameSet = new Set(names);
    const problems: string[] = [];
    for (const w of words) {
      if (!w.example) continue;
      const unknown = analyzeSentence(w.example.hr, index, nameSet).unknown.filter((t) => !ALLOWED_EXTRA.has(t.toLowerCase()));
      if (unknown.length) problems.push(`${w.id}: „${w.example.hr}“ → ${unknown.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });
});
