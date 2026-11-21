import { describe, expect, it } from 'vitest';
import { newSchedulingState } from './scheduler';
import { CardState, type SchedulingState } from './types';
import { isRecognitionSolid, isUnlocked, PRODUCE_MIN_STABILITY_DAYS } from './unlock';

const st = (patch: Partial<SchedulingState>): SchedulingState => ({ ...newSchedulingState(0), ...patch });

describe('unlock rules', () => {
  it('cards without prerequisite are always unlocked', () => {
    expect(isUnlocked({ kind: 'recognize' }, () => undefined)).toBe(true);
  });

  it('missing prerequisite card locks the card', () => {
    expect(isUnlocked({ kind: 'produce', requires: 'x' }, () => undefined)).toBe(false);
  });

  it('DE→HR stays locked while recognition is new or learning', () => {
    for (const state of [CardState.New, CardState.Learning, CardState.Relearning]) {
      const req = st({ state, stability: 50 });
      expect(isUnlocked({ kind: 'produce', requires: 'r' }, () => req)).toBe(false);
    }
  });

  it('DE→HR unlocks only when recognition sits (Review + enough stability)', () => {
    const weak = st({ state: CardState.Review, stability: PRODUCE_MIN_STABILITY_DAYS - 0.5 });
    const solid = st({ state: CardState.Review, stability: PRODUCE_MIN_STABILITY_DAYS });
    expect(isRecognitionSolid(weak)).toBe(false);
    expect(isRecognitionSolid(solid)).toBe(true);
    expect(isUnlocked({ kind: 'produce', requires: 'r' }, () => weak)).toBe(false);
    expect(isUnlocked({ kind: 'produce', requires: 'r' }, () => solid)).toBe(true);
  });

  it('cloze unlocks as soon as the word has graduated to Review', () => {
    expect(isUnlocked({ kind: 'cloze', requires: 'r' }, () => st({ state: CardState.Learning }))).toBe(false);
    expect(isUnlocked({ kind: 'cloze', requires: 'r' }, () => st({ state: CardState.Review, stability: 1 }))).toBe(true);
  });
});
