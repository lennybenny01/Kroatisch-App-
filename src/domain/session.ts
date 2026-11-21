import { shuffle, type Rng } from '../lib/random';
import { CardState, type CardRecord } from './types';
import { isUnlocked } from './unlock';

export interface BuildSessionInput {
  cards: readonly CardRecord[];
  now: number;
  /** Daily goal: new cards per day. */
  newLimit: number;
  /** New cards already introduced today. */
  newIntroducedToday: number;
  /** Units open for new cards (all if omitted). */
  unlockedUnits?: ReadonlySet<string>;
  rng?: Rng;
}

export interface SessionPlan {
  /** Card ids in the order they will be shown. */
  queue: string[];
  dueCount: number;
  newCount: number;
}

/** Cards that are not new and whose due time has come. */
export function dueCards(cards: readonly CardRecord[], now: number): CardRecord[] {
  return cards.filter((c) => !c.suspended && c.state !== CardState.New && c.due <= now);
}

/**
 * New cards that may be introduced, in introduction order. Follow-up cards
 * (DE→HR, cloze) whose prerequisite is learned alternate with fresh words, so
 * new vocabulary keeps coming while known words are deepened.
 */
export function eligibleNewCards(cards: readonly CardRecord[], unlockedUnits?: ReadonlySet<string>): CardRecord[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const unlocked = cards
    .filter(
      (c) =>
        !c.suspended &&
        c.state === CardState.New &&
        (!unlockedUnits || unlockedUnits.has(c.unitId)) &&
        isUnlocked(c, (id) => byId.get(id)),
    )
    .sort((a, b) => a.order - b.order);
  const followUps = unlocked.filter((c) => c.kind !== 'recognize');
  const fresh = unlocked.filter((c) => c.kind === 'recognize');
  const out: CardRecord[] = [];
  while (followUps.length || fresh.length) {
    const f = followUps.shift();
    if (f) out.push(f);
    const n = fresh.shift();
    if (n) out.push(n);
  }
  return out;
}

export function newBudget(newLimit: number, newIntroducedToday: number): number {
  return Math.max(0, newLimit - newIntroducedToday);
}

/**
 * Round-robin across groups (topics) so consecutive cards come from different
 * units. Group order is shuffled; order inside a group is preserved.
 */
export function interleaveByGroup<T>(items: readonly T[], groupOf: (t: T) => string, rng: Rng): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = groupOf(it);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const lists = shuffle([...groups.values()], rng);
  const out: T[] = [];
  while (lists.some((l) => l.length)) {
    for (const l of lists) {
      const it = l.shift();
      if (it !== undefined) out.push(it);
    }
  }
  return out;
}

/** Spreads `inserts` evenly through `base` (first insert not at the very start if base is non-empty). */
export function spreadEvenly<T>(base: readonly T[], inserts: readonly T[]): T[] {
  if (!inserts.length) return [...base];
  if (!base.length) return [...inserts];
  const out: T[] = [];
  const step = (base.length + 1) / (inserts.length + 1);
  let bi = 0;
  inserts.forEach((ins, i) => {
    const target = Math.floor(step * (i + 1));
    while (bi < target && bi < base.length) out.push(base[bi++]!);
    out.push(ins);
  });
  while (bi < base.length) out.push(base[bi++]!);
  return out;
}

/** Avoids showing two cards of the same word back to back (e.g. recognize + cloze of "kava"). */
export function separateSiblings<T>(items: readonly T[], keyOf: (t: T) => string): T[] {
  const a = [...items];
  for (let i = 1; i < a.length; i++) {
    const key = keyOf(a[i]!);
    if (key !== keyOf(a[i - 1]!)) continue;
    // 1) swap with a later card of a different word
    const j = a.findIndex((x, idx) => idx > i && keyOf(x) !== key);
    if (j > i) {
      [a[i], a[j]] = [a[j]!, a[i]!];
      continue;
    }
    // 2) nothing later fits: move the card to an earlier gap between two other words
    const item = a.splice(i, 1)[0]!;
    let p = -1;
    for (let k = 0; k < i; k++) {
      const before = k > 0 ? keyOf(a[k - 1]!) : undefined;
      if (before !== key && keyOf(a[k]!) !== key) {
        p = k;
        break;
      }
    }
    if (p >= 0) a.splice(p, 0, item);
    else a.splice(i, 0, item); // unavoidable (e.g. only one word left)
  }
  return a;
}

/** Builds today's session: interleaved due reviews with the day's new cards spread in. */
export function buildSession({ cards, now, newLimit, newIntroducedToday, unlockedUnits, rng = Math.random }: BuildSessionInput): SessionPlan {
  const due = dueCards(cards, now).sort((a, b) => a.due - b.due);
  const dueMixed = interleaveByGroup(due, (c) => c.unitId, rng);
  const fresh = eligibleNewCards(cards, unlockedUnits).slice(0, newBudget(newLimit, newIntroducedToday));
  const freshMixed = interleaveByGroup(fresh, (c) => c.unitId, rng);
  const merged = separateSiblings(spreadEvenly(dueMixed, freshMixed), (c) => c.wordId);
  return { queue: merged.map((c) => c.id), dueCount: due.length, newCount: fresh.length };
}

/** Cards due again within this window are shown again in the same session. */
export const LEARN_AHEAD_MS = 20 * 60_000;

/**
 * After answering the head of the queue: drop it, and if it is due again soon
 * (learning step after "Nochmal"/"Schwer"), re-insert it a few cards later.
 */
export function advanceQueue(queue: readonly string[], answeredId: string, nextDue: number, now: number): string[] {
  const rest = queue.filter((id, i) => !(i === 0 && id === answeredId));
  if (nextDue - now > LEARN_AHEAD_MS) return rest;
  const gap = nextDue - now <= 60_000 ? 3 : 6;
  const pos = Math.min(gap, rest.length);
  return [...rest.slice(0, pos), answeredId, ...rest.slice(pos)];
}
