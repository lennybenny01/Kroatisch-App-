import { CardState, type CardDef, type SchedulingState } from './types';

/**
 * Recognition "sits" once the card has graduated to Review and FSRS estimates
 * that it will be remembered for at least this many days. Only then is the
 * harder DE→HR direction introduced.
 */
export const PRODUCE_MIN_STABILITY_DAYS = 3;

export function isRecognitionSolid(s: SchedulingState): boolean {
  return s.state === CardState.Review && s.stability >= PRODUCE_MIN_STABILITY_DAYS;
}

/** Whether a (new) card may be introduced now, given its prerequisite. */
export function isUnlocked(
  def: Pick<CardDef, 'kind' | 'requires'>,
  getCard: (id: string) => SchedulingState | undefined,
): boolean {
  if (!def.requires) return true;
  const req = getCard(def.requires);
  if (!req) return false;
  switch (def.kind) {
    case 'produce':
      return isRecognitionSolid(req);
    case 'cloze':
      // Context helps: as soon as the word left the learning steps.
      return req.state === CardState.Review;
    default:
      return true;
  }
}
