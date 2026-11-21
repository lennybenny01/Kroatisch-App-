import { sampleContent } from '../content/fixtures/sample';
import { seededRng } from '../lib/random';
import { newSchedulingState } from './scheduler';
import type { CardRecord } from './types';

export const T0 = new Date('2026-11-02T09:00:00').getTime();
export const MIN = 60_000;
export const DAY = 86_400_000;

/** All 20 sample words as fresh cards (recognize + produce + cloze). */
export function freshCards(now = T0): CardRecord[] {
  return sampleContent.cardDefs.map((d) => ({ ...d, ...newSchedulingState(now) }));
}

export { seededRng };
