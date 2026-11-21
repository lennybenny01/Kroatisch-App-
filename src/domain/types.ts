// ---------- Content (static, shipped with the app) ----------

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase' | 'other';

export interface Unit {
  id: string;
  order: number;
  title: string;
  level: CefrLevel;
  canDo: string[];
}

export interface Word {
  id: string;
  unitId: string;
  /** Croatian lemma, e.g. "kava". */
  hr: string;
  /** Further correct Croatian answers for DE→HR. */
  hrAlt?: string[];
  /** Accepted German meanings; the first one is used as prompt. */
  de: string[];
  pos: PartOfSpeech;
  gender?: 'm' | 'f' | 'n';
  aspect?: 'impf' | 'pf';
  notes?: string;
}

export interface Sentence {
  id: string;
  unitId: string;
  hr: string;
  de: string;
  /** The word that is blanked out in the cloze exercise. */
  clozeWordId: string;
  /** Exact (inflected) form of that word as it appears in `hr`. */
  clozeForm: string;
  /** Grammar hint shown after answering, e.g. "Akkusativ". */
  clozeNote?: string;
}

// ---------- Cards & learning state (IndexedDB) ----------

export type CardKind = 'recognize' | 'produce' | 'cloze';

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
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  newCardsPerDay: 10,
  strictDiacritics: false,
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
  | 'wrong';
