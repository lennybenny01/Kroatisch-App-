import type { CardRecord } from './types';
import { isRecognitionSolid } from './unlock';

/** Share of mastered words needed in a unit to unlock the next one. */
export const UNIT_UNLOCK_THRESHOLD = 0.8;

export interface UnitMastery {
  mastered: number;
  total: number;
  /** 0–1 */
  ratio: number;
}

/** A word counts as mastered when its HR→DE card sits (Review, stability ≥ 3 days). */
export function unitMastery(unitId: string, cards: readonly CardRecord[]): UnitMastery {
  const words = cards.filter((c) => c.unitId === unitId && c.kind === 'recognize' && !c.suspended);
  const mastered = words.filter(isRecognitionSolid).length;
  return { mastered, total: words.length, ratio: words.length ? mastered / words.length : 0 };
}

/**
 * Units that are open for new cards. The first unit is always open; each
 * further unit opens once the previous one reaches the threshold. Units that
 * were unlocked before stay unlocked, even if mastery drops later.
 */
export function computeUnlockedUnits(
  units: readonly { id: string }[],
  cards: readonly CardRecord[],
  previouslyUnlocked: Iterable<string> = [],
  threshold = UNIT_UNLOCK_THRESHOLD,
): Set<string> {
  const open = new Set(previouslyUnlocked);
  if (units[0]) open.add(units[0].id);
  for (let i = 1; i < units.length; i++) {
    const prev = units[i - 1]!;
    if (open.has(units[i]!.id)) continue;
    if (open.has(prev.id) && unitMastery(prev.id, cards).ratio >= threshold) open.add(units[i]!.id);
  }
  return open;
}
