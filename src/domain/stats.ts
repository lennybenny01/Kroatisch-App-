import type { Content } from '../content/build';
import { dayKey } from '../lib/date';
import { shuffle, type Rng } from '../lib/random';
import { interleaveByGroup } from './session';
import { CardState, Rating, type CardRecord, type CefrLevel, type ReviewLog } from './types';
import { isRecognitionSolid } from './unlock';
import { UNIT_UNLOCK_THRESHOLD } from './units';

const DAY = 86_400_000;
export const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];
/** A card counts as consolidated when FSRS expects it to last at least three weeks. */
export const CONSOLIDATED_DAYS = 21;

// ───────────── Level ─────────────

export interface LevelInfo {
  level: CefrLevel;
  words: number;
  mastered: number;
  /** 0–1 share of mastered words. */
  ratio: number;
  reached: boolean;
  hasContent: boolean;
}

export interface LevelProgress {
  levels: LevelInfo[];
  /** Highest level reached in a row from A1 (undefined = beginner). */
  current?: CefrLevel;
  /** The level being worked towards. */
  next?: LevelInfo;
  /** 0–1 progress towards reaching `next` (reached at 80 % mastery). */
  toNext: number;
}

/** A level is reached once 80 % of its words are mastered (same rule as unlocking units). */
export function levelProgress(cards: readonly CardRecord[], content: Pick<Content, 'units'>): LevelProgress {
  const unitLevel = new Map(content.units.map((u) => [u.id, u.level]));
  const levels = LEVELS.map((level) => {
    const rec = cards.filter((c) => c.kind === 'recognize' && unitLevel.get(c.unitId) === level);
    const mastered = rec.filter(isRecognitionSolid).length;
    const ratio = rec.length ? mastered / rec.length : 0;
    return { level, words: rec.length, mastered, ratio, reached: rec.length > 0 && ratio >= UNIT_UNLOCK_THRESHOLD, hasContent: rec.length > 0 };
  });
  let current: CefrLevel | undefined;
  for (const l of levels) {
    if (!l.reached) break;
    current = l.level;
  }
  const next = levels.find((l) => !l.reached);
  return { levels, current, next, toNext: next ? Math.min(1, next.ratio / UNIT_UNLOCK_THRESHOLD) : 1 };
}

// ───────────── New / learning / consolidated ─────────────

export interface StatusCounts {
  neu: number;
  lernen: number;
  gefestigt: number;
}

export function cardStatus(c: Pick<CardRecord, 'state' | 'stability'>): keyof StatusCounts {
  if (c.state === CardState.New) return 'neu';
  if (c.state === CardState.Review && c.stability >= CONSOLIDATED_DAYS) return 'gefestigt';
  return 'lernen';
}

/** Words (by their HR→DE card) and sentences (by their cloze card). */
export function statusCounts(cards: readonly CardRecord[]): { words: StatusCounts; sentences: StatusCounts } {
  const empty = (): StatusCounts => ({ neu: 0, lernen: 0, gefestigt: 0 });
  const words = empty();
  const sentences = empty();
  for (const c of cards) {
    if (c.suspended) continue;
    if (c.kind === 'recognize') words[cardStatus(c)]++;
    else if (c.kind === 'cloze') sentences[cardStatus(c)]++;
  }
  return { words, sentences };
}

// ───────────── Calendar & streak ─────────────

export function activityByDay(logs: readonly Pick<ReviewLog, 'day'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) m.set(l.day, (m.get(l.day) ?? 0) + 1);
  return m;
}

export interface Streaks {
  current: number;
  longest: number;
  /** Has today already been a learning day? */
  today: boolean;
}

/** Current streak counts today if already learned, otherwise up to yesterday (so it isn't lost in the morning). */
export function streaks(days: ReadonlySet<string> | Map<string, number>, now = Date.now()): Streaks {
  const has = (d: string) => (days instanceof Map ? (days.get(d) ?? 0) > 0 : days.has(d));
  const today = has(dayKey(now));
  let current = 0;
  let t = today ? now : now - DAY;
  while (has(dayKey(t))) {
    current++;
    t -= DAY;
  }
  const keys = [...(days instanceof Map ? [...days].filter(([, n]) => n > 0).map(([k]) => k) : days)].sort();
  let longest = 0;
  let run = 0;
  let prev: number | undefined;
  for (const k of keys) {
    const ts = Date.parse(`${k}T12:00:00`);
    run = prev !== undefined && Math.round((ts - prev) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = ts;
  }
  return { current, longest: Math.max(longest, current), today };
}

export interface CalendarCell {
  day: string;
  count: number;
  /** 0 = nothing, 1–4 = intensity bins. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** Bins for the heatmap (reviews per day). */
export const HEAT_BINS = [1, 10, 25, 50] as const;

export function heatLevel(n: number): CalendarCell['level'] {
  if (n <= 0) return 0;
  if (n < HEAT_BINS[1]) return 1;
  if (n < HEAT_BINS[2]) return 2;
  if (n < HEAT_BINS[3]) return 3;
  return 4;
}

/** Weeks × 7 grid (Monday first), the last column containing today. */
export function calendarGrid(activity: Map<string, number>, weeks: number, now = Date.now()): CalendarCell[][] {
  const todayKey = dayKey(now);
  const today = new Date(`${todayKey}T12:00:00`);
  const weekday = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(today.getDate() - weekday - (weeks - 1) * 7);
  const cols: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(date.getTime() + 4 * 3_600_000);
      const count = activity.get(key) ?? 0;
      col.push({ day: key, count, level: heatLevel(count), future: key > todayKey });
    }
    cols.push(col);
  }
  return cols;
}

// ───────────── Accuracy over time ─────────────

export interface AccuracyPoint {
  /** Monday of the week (YYYY-MM-DD). */
  week: string;
  verstehen: { n: number; rate: number } | null;
  sprechen: { n: number; rate: number } | null;
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime() + 4 * 3_600_000);
}

/**
 * Share of known answers per week, separately for understanding (HR→DE) and
 * speaking (DE→HR + cloze). First-contact multiple choice is not counted.
 */
export function accuracyByWeek(
  logs: readonly ReviewLog[],
  kindOf: (cardId: string) => CardRecord['kind'] | undefined,
  weeks: number,
  now = Date.now(),
): AccuracyPoint[] {
  const thisMonday = mondayOf(dayKey(now));
  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${thisMonday}T12:00:00`);
    d.setDate(d.getDate() - i * 7);
    keys.push(dayKey(d.getTime() + 4 * 3_600_000));
  }
  const acc = new Map(keys.map((k) => [k, { v: [0, 0], s: [0, 0] }]));
  for (const l of logs) {
    if (l.wasMultipleChoice) continue;
    const bucket = acc.get(mondayOf(l.day));
    if (!bucket) continue;
    const kind = kindOf(l.cardId);
    if (!kind) continue;
    const slot = kind === 'recognize' ? bucket.v : bucket.s;
    slot[0]!++;
    if (l.rating >= Rating.Hard) slot[1]!++;
  }
  return keys.map((week) => {
    const b = acc.get(week)!;
    const point = (x: number[]) => (x[0] ? { n: x[0], rate: x[1]! / x[0] } : null);
    return { week, verstehen: point(b.v), sprechen: point(b.s) };
  });
}

// ───────────── Due forecast ─────────────

/** Reviews due on each of the next `days` days (today includes everything overdue). */
export function dueForecast(cards: readonly CardRecord[], days = 7, now = Date.now()): { day: string; count: number }[] {
  const keys = Array.from({ length: days }, (_, i) => dayKey(now + i * DAY));
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const c of cards) {
    if (c.suspended || c.state === CardState.New) continue;
    const k = c.due <= now ? keys[0]! : dayKey(c.due);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return keys.map((day) => ({ day, count: counts.get(day)! }));
}

// ───────────── Weak spots ─────────────

export interface WeakItem {
  id: string;
  label: string;
  sub?: string;
  errors: number;
  attempts: number;
  /** 0–1 */
  errorRate: number;
}

export interface WeakSpots {
  words: WeakItem[];
  grammar: WeakItem[];
  units: WeakItem[];
}

/** Lookback window for weak spots. */
export const WEAK_WINDOW_DAYS = 60;

/**
 * Words, grammar topics (cases, aspect, …) and units with the most mistakes.
 * A mistake is a review rated „Nochmal“.
 */
export function weakSpots(
  logs: readonly ReviewLog[],
  cards: readonly CardRecord[],
  content: {
    wordById: ReadonlyMap<string, { hr: string; de: string[] }>;
    sentenceById: ReadonlyMap<string, { grammarId?: string }>;
    grammarById: ReadonlyMap<string, { title: string }>;
    unitById: ReadonlyMap<string, { title: string; level: string }>;
  },
  now = Date.now(),
  limit = 5,
): WeakSpots {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const since = now - WEAK_WINDOW_DAYS * DAY;
  const tally = new Map<string, { e: number; a: number }>();
  const add = (key: string, wrong: boolean) => {
    const t = tally.get(key) ?? { e: 0, a: 0 };
    t.a++;
    if (wrong) t.e++;
    tally.set(key, t);
  };
  for (const l of logs) {
    if (l.ts < since || l.wasMultipleChoice) continue;
    const c = byId.get(l.cardId);
    if (!c) continue;
    const wrong = l.rating === Rating.Again;
    add(`w:${c.wordId}`, wrong);
    add(`u:${c.unitId}`, wrong);
    if (c.sentenceId) {
      const g = content.sentenceById.get(c.sentenceId)?.grammarId;
      if (g) add(`g:${g}`, wrong);
    }
  }
  const items = (prefix: string, minAttempts: number, label: (id: string) => { label: string; sub?: string } | undefined) =>
    [...tally]
      .filter(([k, t]) => k.startsWith(prefix) && t.e > 0 && t.a >= minAttempts)
      .map(([k, t]) => {
        const id = k.slice(prefix.length);
        const l = label(id);
        return l ? { id, ...l, errors: t.e, attempts: t.a, errorRate: t.e / t.a } : undefined;
      })
      .filter((x): x is WeakItem => !!x)
      .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
      .slice(0, limit);
  return {
    words: items('w:', 1, (id) => {
      const w = content.wordById.get(id);
      return w && { label: w.hr, sub: w.de.join(', ') };
    }),
    grammar: items('g:', 2, (id) => {
      const g = content.grammarById.get(id);
      return g && { label: g.title };
    }),
    units: items('u:', 3, (id) => {
      const u = content.unitById.get(id);
      return u && { label: u.title, sub: u.level };
    }),
  };
}

// ───────────── Focused practice ─────────────

export type FocusTarget = { type: 'word' | 'grammar' | 'unit'; id: string } | { type: 'weak' };

/** Cards for „Jetzt gezielt üben“: already seen cards of the weak spot, the shakiest first. */
export function focusCards(
  target: FocusTarget,
  cards: readonly CardRecord[],
  content: { sentenceById: ReadonlyMap<string, { grammarId?: string }> },
  weak?: WeakSpots,
  limit = 20,
  rng: Rng = Math.random,
): CardRecord[] {
  const seen = cards.filter((c) => !c.suspended && c.state !== CardState.New);
  const grammarOf = (c: CardRecord) => (c.sentenceId ? content.sentenceById.get(c.sentenceId)?.grammarId : undefined);
  let pool: CardRecord[];
  switch (target.type) {
    case 'word':
      pool = seen.filter((c) => c.wordId === target.id);
      break;
    case 'grammar':
      pool = seen.filter((c) => grammarOf(c) === target.id);
      break;
    case 'unit':
      pool = seen.filter((c) => c.unitId === target.id);
      break;
    case 'weak': {
      const words = new Set(weak?.words.map((w) => w.id));
      const grammar = new Set(weak?.grammar.map((g) => g.id));
      pool = seen.filter((c) => words.has(c.wordId) || (grammarOf(c) !== undefined && grammar.has(grammarOf(c)!)));
      break;
    }
  }
  // Shakiest first: most lapses, then lowest stability.
  const ranked = shuffle(pool, rng).sort((a, b) => b.lapses - a.lapses || a.stability - b.stability).slice(0, limit);
  return interleaveByGroup(ranked, (c) => c.wordId, rng);
}
