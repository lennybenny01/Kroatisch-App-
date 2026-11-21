import type { CefrLevel, Example, GrammarTopic, PartOfSpeech } from '../domain/types';

/** Format of one unit file in src/content/<level>/*.json */
export interface UnitFile {
  id: string;
  order: number;
  level: CefrLevel;
  title: string;
  description?: string;
  canDo: string[];
  grammar: GrammarTopic[];
  words: WordEntry[];
  sentences: SentenceEntry[];
  /** Further inflected forms of words from earlier units, needed by this unit's sentences (e.g. Perfekt „bio“ of biti). */
  addForms?: Record<string, string[]>;
}

export interface WordEntry {
  id: string;
  hr: string;
  hrAlt?: string[];
  de: string[];
  pos: PartOfSpeech;
  gender?: 'm' | 'f' | 'n';
  pluralOnly?: boolean;
  aspect?: 'impf' | 'pf' | 'both';
  aspectPartner?: string | null;
  forms?: string[];
  example?: Example;
  note?: string;
}

export interface SentenceEntry {
  id: string;
  hr: string;
  de: string;
  grammar?: string;
  note?: string;
  /** Optional: force the cloze word instead of using the newest word. */
  cloze?: string;
}

/** Proper names (people, places) with their inflected forms – ignored when counting vocabulary. */
export type NameList = string[];
