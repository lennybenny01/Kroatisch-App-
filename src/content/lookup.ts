import type { ContentLookup } from '../domain/exercise';
import { CUSTOM_UNIT, type CustomWord, type Word } from '../domain/types';
import type { Content } from './build';

/** An own word in the shape of a course word. */
export function customToWord(c: CustomWord): Word {
  const w: Word = { id: c.id, unitId: CUSTOM_UNIT, order: -1, hr: c.hr, de: c.de, pos: c.pos };
  if (c.hrAlt) w.hrAlt = c.hrAlt;
  if (c.gender) w.gender = c.gender;
  if (c.notes) w.notes = c.notes;
  if (c.example) w.example = c.example;
  return w;
}

export type Lookup = ContentLookup & Pick<Content, 'unitById' | 'grammarById'>;

/** Course content plus the learner's own words – what exercises, the card list and statistics look things up in. */
export function buildLookup(content: Content, custom: readonly CustomWord[]): Lookup {
  if (!custom.length) return content;
  const own = custom.map(customToWord);
  const words = [...content.words, ...own];
  return { ...content, words, wordById: new Map(words.map((w) => [w.id, w])) };
}

export const unitTitle = (lookup: Pick<Content, 'unitById'>, unitId: string) =>
  unitId === CUSTOM_UNIT ? 'Eigene Karten' : (lookup.unitById.get(unitId)?.title ?? '');
