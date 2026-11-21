import type { CardDef, Sentence, Unit, Word } from '../domain/types';
import { CONTENT_VERSION, sentences, units, words } from './sample';

export { CONTENT_VERSION };

export const unitById = new Map<string, Unit>(units.map((u) => [u.id, u]));
export const wordById = new Map<string, Word>(words.map((w) => [w.id, w]));
export const sentenceById = new Map<string, Sentence>(sentences.map((s) => [s.id, s]));
export { units, words, sentences };

export const cardId = {
  recognize: (wordId: string) => `${wordId}:recognize`,
  produce: (wordId: string) => `${wordId}:produce`,
  cloze: (sentenceId: string) => `${sentenceId}:cloze`,
};

/**
 * Derives all card definitions from content:
 * - every word → recognize (HR→DE) + produce (DE→HR, gated behind recognize)
 * - every sentence → cloze (gated behind recognize of the blanked word)
 */
export function buildCardDefs(
  content: { units: Unit[]; words: Word[]; sentences: Sentence[] } = { units, words, sentences },
): CardDef[] {
  const unitOrder = new Map(content.units.map((u) => [u.id, u.order]));
  const defs: CardDef[] = [];
  content.words.forEach((w, i) => {
    const base = (unitOrder.get(w.unitId) ?? 999) * 1000 + i * 3;
    defs.push({ id: cardId.recognize(w.id), kind: 'recognize', unitId: w.unitId, wordId: w.id, order: base });
    defs.push({
      id: cardId.produce(w.id),
      kind: 'produce',
      unitId: w.unitId,
      wordId: w.id,
      order: base + 1,
      requires: cardId.recognize(w.id),
    });
  });
  const wordUnit = new Map(content.words.map((w) => [w.id, w.unitId]));
  content.sentences.forEach((s, i) => {
    if (!wordUnit.has(s.clozeWordId)) throw new Error(`Sentence ${s.id}: unknown word ${s.clozeWordId}`);
    defs.push({
      id: cardId.cloze(s.id),
      kind: 'cloze',
      unitId: s.unitId,
      wordId: s.clozeWordId,
      sentenceId: s.id,
      order: (unitOrder.get(s.unitId) ?? 999) * 1000 + 500 + i,
      requires: cardId.recognize(s.clozeWordId),
    });
  });
  return defs.sort((a, b) => a.order - b.order);
}

/** Everything the exercise builder needs to look up content. */
export const contentLookup = { words, sentences, wordById, sentenceById };
