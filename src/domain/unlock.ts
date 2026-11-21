import { CardState, type CardDef, type SchedulingState } from './types';

/**
 * Recognition "sits" once the card has graduated to Review and FSRS estimates
 * that it will be remembered for at least this many days. Only then is the
 * harder DE→HR direction introduced – and the word counts as mastered.
 */
export const PRODUCE_MIN_STABILITY_DAYS = 3;

export function isRecognitionSolid(s: SchedulingState): boolean {
  return s.state === CardState.Review && s.stability >= PRODUCE_MIN_STABILITY_DAYS;
}

/** Whether a (new) card may be introduced now, given its prerequisites. */
export function isUnlocked(
  def: Pick<CardDef, 'kind' | 'requires' | 'requiresSeen'>,
  getCard: (id: string) => SchedulingState | undefined,
): boolean {
  // i+1: every other word of a sentence must have been seen at least once.
  if (def.requiresSeen?.some((id) => (getCard(id)?.state ?? CardState.New) === CardState.New)) return false;
  if (!def.requires) return true;
  const req = getCard(def.requires);
  if (!req) return false;
  switch (def.kind) {
    case 'produce':
      return isRecognitionSolid(req);
    case 'cloze':
      // Context helps: as soon as the word has left the learning steps.
      return req.state === CardState.Review;
    default:
      return true;
  }
}
