import u1 from './a1/01-begruessung.json';
import u2 from './a1/02-ich-und-du.json';
import u3 from './a1/03-zahlen-zeit-tage.json';
import u4 from './a1/04-essen-trinken.json';
import u5 from './a1/05-familie-menschen.json';
import u6 from './a1/06-wichtige-verben.json';
import u7 from './a1/07-orte-richtungen.json';
import a2u8 from './a2/08-einkaufen.json';
import a2u9 from './a2/09-restaurant-cafe.json';
import a2u10 from './a2/10-weg-fragen.json';
import a2u11 from './a2/11-arzt-apotheke.json';
import a2u12 from './a2/12-wohnung-haushalt.json';
import a2u13 from './a2/13-arbeit.json';
import a2u14 from './a2/14-smalltalk.json';
import a2u15 from './a2/15-wetter.json';
import a2u16 from './a2/16-plaene-machen.json';
import a2u17 from './a2/17-urlaub-am-meer.json';
import names from './names.json';
import { buildContent } from './build';
import type { UnitFile } from './schema';

export { buildContent, cardId, type Content } from './build';

/** Bump when content changes in a way that needs a migration. */
export const CONTENT_VERSION = 3;

export const a1Files = [u1, u2, u3, u4, u5, u6, u7] as unknown as UnitFile[];
export const a2Files = [a2u8, a2u9, a2u10, a2u11, a2u12, a2u13, a2u14, a2u15, a2u16, a2u17] as unknown as UnitFile[];

/** The course content used by the app: A1 followed by A2. */
export const content = buildContent([...a1Files, ...a2Files], names);

export const { units, words, sentences, grammar, unitById, wordById, sentenceById, grammarById } = content;
