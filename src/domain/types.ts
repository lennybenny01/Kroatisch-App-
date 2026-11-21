// ---------- Content (static, shipped with the app) ----------

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'prep'
  | 'conj'
  | 'num'
  | 'particle'
  | 'phrase'
  | 'other';

export interface Example {
  hr: string;
  de: string;
}

/** Collapsible grammar explanation (German). */
export interface GrammarTopic {
  id: string;
  title: string;
  summary: string;
  body?: string[];
  table?: { head: string[]; rows: string[][] };
  examples?: Example[];
}

export interface Unit {
  id: string;
  order: number;
  title: string;
  level: CefrLevel;
  description?: string;
  canDo: string[];
  grammarIds: string[];
}

export interface Word {
  id: string;
  unitId: string;
  /** Position in the curriculum (unit order × 1000 + index). */
  order: number;
  /** Croatian lemma, e.g. "kava". */
  hr: string;
  /** Further correct Croatian answers for DE→HR. */
  hrAlt?: string[];
  /** Accepted German meanings; the first one is used as prompt. */
  de: string[];
  pos: PartOfSpeech;
  gender?: 'm' | 'f' | 'n';
  pluralOnly?: boolean;
  aspect?: 'impf' | 'pf' | 'both';
  /** Aspect partner of a verb, null if it has none. */
  aspectPartner?: string | null;
  /** Inflected forms used in the course (for recognising words in sentences). */
  forms?: string[];
  example?: Example;
  /** Short grammar/usage note in German. */
  notes?: string;
}

export interface Sentence {
  id: string;
  unitId: string;
  hr: string;
  de: string;
  /** All course words the sentence consists of, in order of appearance. */
  wordIds: string[];
  /** The newest word of the sentence – it is blanked out in the cloze exercise (i+1). */
  clozeWordId: string;
  /** Exact form of that word as it appears in `hr`. */
  clozeForm: string;
  /** Character offset of the cloze form in `hr` (the same letters may occur earlier, e.g. „doći do“). */
  clozeStart: number;
  /** Grammar hint shown after answering, e.g. "Akkusativ". */
  clozeNote?: string;
  grammarId?: string;
}

/** A free translation exercise (DE → HR). */
export interface Translation {
  id: string;
  unitId: string;
  de: string;
  hr: string[];
  keywords: string[][];
  note?: string;
  /** Course words of the model translation. */
  wordIds: string[];
}

export interface ReadingTextModel {
  id: string;
  unitId: string;
  title: string;
  hr: string;
  de: string;
  glossary: { hr: string; de: string }[];
  questions: { q: string; options: string[]; answer: number }[];
}

/** A word the learner added themselves („Eigene Karte“). */
export interface CustomWord {
  id: string;
  hr: string;
  hrAlt?: string[];
  de: string[];
  pos: PartOfSpeech;
  gender?: 'm' | 'f' | 'n';
  notes?: string;
  example?: Example;
  /** Also create a DE→HR card. */
  practiceProduce: boolean;
  createdAt: number;
}

/** Unit id of all custom cards – always unlocked. */
export const CUSTOM_UNIT = 'custom';

// ---------- Cards & learning state (IndexedDB) ----------

export type CardKind = 'recognize' | 'produce' | 'cloze' | 'translate';

/** Mirrors ts-fsrs `State`. */
export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

/** Mirrors ts-fsrs `Rating` (without Manual). */
export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

/** FSRS memory state, stored with plain numbers (epoch ms) for IndexedDB. */
export interface SchedulingState {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: number;
}

/** Static definition of a card, derived from content. */
export interface CardDef {
  id: string;
  kind: CardKind;
  unitId: string;
  wordId: string;
  sentenceId?: string;
  /** Position in the curriculum; new cards are introduced in this order. */
  order: number;
  /** Card that must be learned before this one is introduced. */
  requires?: string;
  /** Free translation exercise (kind 'translate'). */
  translationId?: string;
  /** Cards that must at least have been seen once (the other words of a cloze sentence). */
  requiresSeen?: string[];
}

export interface CardRecord extends CardDef, SchedulingState {
  suspended?: boolean;
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  ts: number;
  /** Day bucket (see dayKey) – used for daily limits/stats. */
  day: string;
  rating: Rating;
  stateBefore: CardState;
  wasMultipleChoice: boolean;
  /** Answer given by voice (speech recognition). */
  spoken?: boolean;
  answer?: string;
  verdict?: AnswerVerdict;
  durationMs: number;
}

export interface Settings {
  id: 'settings';
  theme: 'system' | 'light' | 'dark';
  newCardsPerDay: number;
  /** If true, missing diacritics count as wrong instead of "almost". */
  strictDiacritics: boolean;
  /** Speaking mode: answer by microphone first (keyboard as fallback). */
  speakAnswers: boolean;
  /** Read the Croatian solution aloud after answering. */
  autoSpeak: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  newCardsPerDay: 10,
  strictDiacritics: false,
  speakAnswers: false,
  autoSpeak: true,
};

// ---------- Answer checking ----------

export type AnswerVerdict =
  /** exactly right (ignoring case/punctuation) */
  | 'correct'
  /** right except for diacritics: "kuca" for "kuća" */
  | 'diacritics'
  /** small typo in a German answer */
  | 'typo'
  /** cloze: user typed the dictionary form instead of the inflected one */
  | 'form'
  /** free translation: different wording, but all key words there */
  | 'understood'
  /** free translation: some key words missing */
  | 'partial'
  | 'wrong';
