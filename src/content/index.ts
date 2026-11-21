import u1 from './a1/01-begruessung.json';
import u2 from './a1/02-ich-und-du.json';
import u3 from './a1/03-zahlen-zeit-tage.json';
import u4 from './a1/04-essen-trinken.json';
import u5 from './a1/05-familie-menschen.json';
import u6 from './a1/06-wichtige-verben.json';
import u7 from './a1/07-orte-richtungen.json';
import names from './names.json';
import { buildContent } from './build';
import type { UnitFile } from './schema';

export { buildContent, cardId, type Content } from './build';

/** Bump when content changes in a way that needs a migration. */
export const CONTENT_VERSION = 4;

export const a1Files = [u1, u2, u3, u4, u5, u6, u7] as unknown as UnitFile[];
/** Unit files of further levels are picked up automatically (one JSON file per unit). */
const byFile = (mods: Record<string, unknown>) =>
  Object.entries(mods)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => ((m as { default?: unknown }).default ?? m) as UnitFile);
export const a2Files = byFile(import.meta.glob('./a2/*.json', { eager: true }));
export const b1Files = byFile(import.meta.glob('./b1/*.json', { eager: true }));
export const b2Files = byFile(import.meta.glob('./b2/*.json', { eager: true }));

/** The course content used by the app: A1 → A2 → B1 → B2. */
export const content = buildContent([...a1Files, ...a2Files, ...b1Files, ...b2Files], names);

export const { units, words, sentences, grammar, unitById, wordById, sentenceById, grammarById } = content;
