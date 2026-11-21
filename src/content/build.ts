import type { CardDef, GrammarTopic, Sentence, Unit, Word } from '../domain/types';
import { analyzeSentence, buildFormIndex, type SentenceAnalysis } from './analyze';
import type { UnitFile } from './schema';

export interface Content {
  units: Unit[];
  words: Word[];
  sentences: Sentence[];
  grammar: GrammarTopic[];
  unitById: Map<string, Unit>;
  wordById: Map<string, Word>;
  sentenceById: Map<string, Sentence>;
  grammarById: Map<string, GrammarTopic>;
  cardDefs: CardDef[];
  /** Raw analysis per sentence id (used by the content validation tests). */
  analysis: Map<string, SentenceAnalysis>;
}

export const cardId = {
  recognize: (wordId: string) => `${wordId}:recognize`,
  produce: (wordId: string) => `${wordId}:produce`,
  cloze: (sentenceId: string) => `${sentenceId}:cloze`,
};

/** Turns unit files into the runtime content model and derives all cards. */
export function buildContent(files: readonly UnitFile[], names: readonly string[] = []): Content {
  const sorted = [...files].sort((a, b) => a.order - b.order);
  const units: Unit[] = sorted.map((f) => ({
    id: f.id,
    order: f.order,
    title: f.title,
    level: f.level,
    description: f.description,
    canDo: f.canDo,
    grammarIds: f.grammar.map((g) => g.id),
  }));
  const grammar = sorted.flatMap((f) => f.grammar);

  const words: Word[] = sorted.flatMap((f) =>
    f.words.map((w, i) => {
      const { note, ...rest } = w;
      const word: Word = { ...rest, unitId: f.id, order: f.order * 1000 + i };
      if (note) word.notes = note;
      return word;
    }),
  );
  const wordById = new Map(words.map((w) => [w.id, w]));
  // Forms that later units add to earlier words (Perfekt, Futur, pronoun cases …).
  for (const f of sorted) {
    for (const [id, forms] of Object.entries(f.addForms ?? {})) {
      const w = wordById.get(id);
      if (!w) throw new Error(`${f.id}: addForms for unknown word ${id}`);
      if (w.order >= f.order * 1000) throw new Error(`${f.id}: addForms may only extend words of earlier units (${id})`);
      w.forms = [...new Set([...(w.forms ?? []), ...forms])];
    }
  }
  const index = buildFormIndex(words);
  const nameSet = new Set(names);

  const analysis = new Map<string, SentenceAnalysis>();
  const sentences: Sentence[] = [];
  for (const f of sorted) {
    for (const s of f.sentences) {
      const a = analyzeSentence(s.hr, index, nameSet);
      analysis.set(s.id, a);
      const newest = s.cloze
        ? a.matches.find((m) => m.wordId === s.cloze)
        : [...a.matches].sort((x, y) => wordById.get(y.wordId)!.order - wordById.get(x.wordId)!.order)[0];
      if (!newest) continue; // invalid sentence – reported by the validation tests
      const sentence: Sentence = {
        id: s.id,
        unitId: f.id,
        hr: s.hr.normalize('NFC'),
        de: s.de,
        wordIds: [...new Set(a.matches.map((m) => m.wordId))],
        clozeWordId: newest.wordId,
        clozeForm: s.hr.normalize('NFC').slice(newest.start, newest.end),
        clozeStart: newest.start,
      };
      if (s.note) sentence.clozeNote = s.note;
      if (s.grammar) sentence.grammarId = s.grammar;
      sentences.push(sentence);
    }
  }

  return {
    units,
    words,
    sentences,
    grammar,
    unitById: new Map(units.map((u) => [u.id, u])),
    wordById,
    sentenceById: new Map(sentences.map((s) => [s.id, s])),
    grammarById: new Map(grammar.map((g) => [g.id, g])),
    cardDefs: buildCardDefs(words, sentences, units),
    analysis,
  };
}

/**
 * Derives all card definitions:
 * - every word → recognize (HR→DE) + produce (DE→HR, gated behind recognize)
 * - every sentence → cloze, gated behind its newest word; the other words must have been seen
 */
export function buildCardDefs(words: readonly Word[], sentences: readonly Sentence[], units: readonly Unit[]): CardDef[] {
  const unitOrder = new Map(units.map((u) => [u.id, u.order]));
  const wordOrder = new Map(words.map((w) => [w.id, w.order]));
  const defs: CardDef[] = [];
  for (const w of words) {
    const base = w.order * 3;
    defs.push({ id: cardId.recognize(w.id), kind: 'recognize', unitId: w.unitId, wordId: w.id, order: base });
    defs.push({ id: cardId.produce(w.id), kind: 'produce', unitId: w.unitId, wordId: w.id, order: base + 1, requires: cardId.recognize(w.id) });
  }
  for (const s of sentences) {
    const others = s.wordIds.filter((id) => id !== s.clozeWordId);
    const def: CardDef = {
      id: cardId.cloze(s.id),
      kind: 'cloze',
      unitId: s.unitId,
      wordId: s.clozeWordId,
      sentenceId: s.id,
      order: (wordOrder.get(s.clozeWordId) ?? (unitOrder.get(s.unitId) ?? 0) * 1000) * 3 + 2,
      requires: cardId.recognize(s.clozeWordId),
    };
    if (others.length) def.requiresSeen = others.map(cardId.recognize);
    defs.push(def);
  }
  return defs.sort((a, b) => a.order - b.order);
}
