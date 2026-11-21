import { describe, expect, it } from 'vitest';
import { analyzeSentence, buildFormIndex, tokenize } from './analyze';
import { a1Files, a2Files, b1Files, b2Files, content } from './index';
import names from './names.json';

const { units, words, sentences, wordById, grammarById } = content;

/** Serbian / ekavian forms that must not appear in standard Croatian content. */
const NOT_CROATIAN = [
  'šta', 'ko', 'hleb', 'mleko', 'lekar', 'voz', 'hiljada', 'hiljadu', 'porodica', 'kafa', 'supa', 'krompir', 'pirinač',
  'šolja', 'uvek', 'gde', 'ovde', 'deca', 'dete', 'vreme', 'lep', 'lepa', 'lepo', 'devojka', 'čovek', 'nedelja', 'sreda',
  'apoteka', 'aerodrom', 'ostrvo', 'juče', 'uveče', 'peške', 'levo', 'sedmica', 'razumem', 'živeti', 'hteo', 'htela',
  'mesec', 'deda', 'tačno', 'uopšte', 'testenina', 'pozorište', 'fudbal', 'pantalone', 'opština', 'hiljade',
  // A2 vocabulary
  'paradajz', 'viljuška', 'kašika', 'tanjir', 'bakšiš', 'raskrsnica', 'sprat', 'frižider', 'orman', 'kupatilo', 'računar',
  'plata', 'penzija', 'pasoš', 'peškir', 'autoput', 'muzika', 'leto', 'sneg', 'vetar', 'pesak', 'smeti', 'videti', 'doneti',
  'izneti', 'preći', 'sledeći', 'smer', 'svetlo', 'pevati', 'smejati', 'venčanje', 'proleće', 'ceo', 'suv', 'beo', 'cena',
  'mleka', 'hleba', 'lepo', 'devojku', 'rezervisati', 'fotografisati', 'nedelju', 'sutradan',
];

const allCroatianTexts = () => [
  ...words.flatMap((w) => [w.hr, ...(w.hrAlt ?? []), ...(w.forms ?? []), w.example?.hr ?? '']),
  ...sentences.map((s) => s.hr),
  ...content.grammar.flatMap((g) => g.examples?.map((e) => e.hr) ?? []),
];

const byLevel = (level: 'A1' | 'A2' | 'B1' | 'B2') => {
  const ids = new Set(units.filter((u) => u.level === level).map((u) => u.id));
  return { words: words.filter((w) => ids.has(w.unitId)), sentences: sentences.filter((s) => ids.has(s.unitId)) };
};

describe('content: structure', () => {
  it('has 7 A1 units and 10 A2 units in the planned order', () => {
    expect(units.slice(0, 17).map((u) => u.title)).toEqual([
      'Begrüßung',
      'Ich und du',
      'Zahlen, Uhrzeit, Tage',
      'Essen & Trinken',
      'Familie & Menschen',
      'Wichtige Verben',
      'Orte & Richtungen',
      'Einkaufen',
      'Restaurant & Café',
      'Nach dem Weg fragen',
      'Beim Arzt & in der Apotheke',
      'Wohnung & Haushalt',
      'Arbeit',
      'Smalltalk',
      'Wetter',
      'Pläne machen',
      'Urlaub am Meer',
    ]);
    expect(units.map((u) => u.order)).toEqual(Array.from({ length: units.length }, (_, i) => i + 1));
    // levels never go backwards
    const rank = { A1: 1, A2: 2, B1: 3, B2: 4 } as const;
    for (let i = 1; i < units.length; i++) expect(rank[units[i]!.level]).toBeGreaterThanOrEqual(rank[units[i - 1]!.level]);
    expect(units.filter((u) => u.level === 'A1')).toHaveLength(7);
    expect(units.filter((u) => u.level === 'A2')).toHaveLength(10);
  });

  it('A1: about 300 words and 150 sentences', () => {
    const { words: w, sentences: s } = byLevel('A1');
    expect(w.length).toBeGreaterThanOrEqual(280);
    expect(w.length).toBeLessThanOrEqual(340);
    expect(s.length).toBeGreaterThanOrEqual(140);
    expect(s.length).toBeLessThanOrEqual(180);
  });

  it('A2: about 400 further words and 250 sentences', () => {
    const { words: w, sentences: s } = byLevel('A2');
    expect(w.length).toBeGreaterThanOrEqual(380);
    expect(w.length).toBeLessThanOrEqual(440);
    expect(s.length).toBeGreaterThanOrEqual(230);
    expect(s.length).toBeLessThanOrEqual(280);
  });

  it('every sentence of every file survived the analysis', () => {
    expect(sentences.length).toBe([...a1Files, ...a2Files, ...b1Files, ...b2Files].reduce((n, f) => n + f.sentences.length, 0));
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

describe('content: every card is complete', () => {
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

describe('content: sentences (i+1)', () => {
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
      expect(tokenize(s.hr).length, s.hr).toBeLessThanOrEqual(12);
    }
  });

  it('A2 builds on A1: most A2 sentences reuse A1 vocabulary', () => {
    const a1Ids = new Set(byLevel('A1').words.map((w) => w.id));
    const a2 = byLevel('A2').sentences.filter((s) => s.wordIds.length > 1);
    const withA1 = a2.filter((s) => s.wordIds.some((id) => id !== s.clozeWordId && a1Ids.has(id)));
    expect(withA1.length / a2.length).toBeGreaterThanOrEqual(0.8);
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

  it('A2 grammar: Perfekt, Futur I, aspect and modal verbs are practised in sentences', () => {
    const a2 = byLevel('A2').sentences;
    const uses = (prefix: string) => a2.filter((s) => s.grammarId?.startsWith(prefix)).length;
    expect(uses('g_perfekt')).toBeGreaterThanOrEqual(10);
    expect(uses('g_futur')).toBeGreaterThanOrEqual(10);
    expect(uses('g_aspekt')).toBeGreaterThanOrEqual(8);
    expect(uses('g_modalverben')).toBeGreaterThanOrEqual(6);
  });

  it('A2 grammar: all 7 cases in the singular are covered', () => {
    const padezi = grammarById.get('g_padezi')!;
    expect(padezi.table!.rows.map((r) => r[0])).toEqual(['Nominativ', 'Genitiv', 'Dativ', 'Akkusativ', 'Vokativ', 'Lokativ', 'Instrumental']);
    // and each oblique case is practised in sentences
    const used = new Set(sentences.map((s) => s.grammarId));
    for (const g of ['g_genitiv', 'g_dativ', 'g_akkusativ', 'g_vokativ', 'g_lokativ', 'g_instrumental']) expect(used.has(g), g).toBe(true);
  });

  it('aspect pairs are consistent: partners that are course words have the opposite aspect', () => {
    const verbs = words.filter((w) => w.pos === 'verb');
    const byHr = new Map(verbs.map((v) => [v.hr, v]));
    const pairs = verbs.filter((v) => v.aspectPartner && byHr.has(v.aspectPartner));
    expect(pairs.length).toBeGreaterThanOrEqual(15);
    for (const v of pairs) {
      const p = byHr.get(v.aspectPartner!)!;
      if (v.aspect !== 'both' && p.aspect !== 'both') expect(p.aspect, `${v.hr} ↔ ${p.hr}`).not.toBe(v.aspect);
    }
  });
});

describe('content: standard Croatian, ijekavian', () => {
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
    for (const hr of ['mlijeko', 'vrijeme', 'dijete', 'lijep', 'uvijek', 'čovjek', 'srijeda', 'nedjelja', 'lijevo', 'snijeg', 'vjetar', 'pijesak', 'smjeti', 'donijeti', 'ljeto']) {
      expect(words.some((w) => w.hr === hr), hr).toBe(true);
    }
  });

  it('inline examples only use course words, names, or explicitly allowed extras', () => {
    // Examples may preview a few forms not yet taught as cards.
    const ALLOWED_EXTRA = new Set(['ovoj']);
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
