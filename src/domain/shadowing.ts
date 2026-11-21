import { shuffle, type Rng } from '../lib/random';
import { CardState, type CardRecord, type Sentence } from './types';

/**
 * Sentences for a shadowing round: only sentences whose words have all been
 * seen already (i+1 also for listening). Falls back to the first sentences of
 * the course when nothing has been learned yet.
 */
export function pickShadowingSentences(
  sentences: readonly Sentence[],
  cards: readonly CardRecord[],
  n = 8,
  rng: Rng = Math.random,
): Sentence[] {
  const seen = new Set(cards.filter((c) => c.kind === 'recognize' && c.state !== CardState.New).map((c) => c.wordId));
  const known = sentences.filter((s) => s.wordIds.length > 0 && s.wordIds.every((id) => seen.has(id)));
  if (known.length === 0) return sentences.slice(0, n);
  // Newer sentences (later in the course) first, but mixed.
  const recent = known.slice(-n * 3);
  return shuffle(recent, rng).slice(0, n);
}
