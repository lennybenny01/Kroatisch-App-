import type { PronPair, PronSound } from '../content/pronunciation';
import { shuffle, type Rng } from '../lib/random';

export interface PronQuestion {
  /** Sound or pair this question belongs to. */
  groupId: string;
  word: string;
  /** Word with a gap, e.g. "_aj". */
  blank: string;
  de: string;
  answer: string;
  options: string[];
}

export interface PronunciationProgress {
  /** Sounds whose exercise was finished at least once. */
  practised: string[];
  /** Hard pairs (č/ć, dž/đ) whose exercise was finished. */
  pairs: string[];
  /** Set when the lesson counts as done. */
  completedAt?: number;
}

export const EMPTY_PRON_PROGRESS: PronunciationProgress = { practised: [], pairs: [] };

export function fillBlank(blank: string, answer: string): string {
  return blank.replace('_', answer);
}

/** Replaces the first occurrence of `letter` in `word` with a gap. */
export function blankLetter(word: string, letter: string): string {
  const i = word.indexOf(letter);
  return i < 0 ? word : word.slice(0, i) + '_' + word.slice(i + letter.length);
}

/** Listening exercise for one sound: hear the word, tap the right letter. */
export function soundQuiz(sound: PronSound, rng: Rng = Math.random): PronQuestion[] {
  return sound.items.map((it) => ({
    groupId: sound.id,
    word: it.word,
    blank: it.blank,
    de: it.de,
    answer: sound.letter,
    options: shuffle(sound.options, rng),
  }));
}

/** Exercise for a hard pair: every example word, choose between the two letters. */
export function pairQuiz(pair: PronPair, rng: Rng = Math.random): PronQuestion[] {
  const qs = [pair.left, pair.right].flatMap((side) =>
    side.words.map((w) => ({
      groupId: pair.id,
      word: w.hr,
      blank: blankLetter(w.hr, side.letter),
      de: w.de,
      answer: side.letter,
      options: [pair.left.letter, pair.right.letter],
    })),
  );
  return shuffle(qs, rng);
}

/** Final check: one random word per sound, in random order. */
export function mixedQuiz(sounds: readonly PronSound[], rng: Rng = Math.random): PronQuestion[] {
  const picks = sounds.map((s) => {
    const q = soundQuiz(s, rng);
    return q[Math.floor(rng() * q.length)]!;
  });
  return shuffle(picks, rng);
}

/** The lesson is done when every sound and both pairs have been practised (or it was completed explicitly). */
export function isPronunciationComplete(
  p: PronunciationProgress,
  sounds: readonly { id: string }[],
  pairs: readonly { id: string }[],
): boolean {
  if (p.completedAt) return true;
  return sounds.every((s) => p.practised.includes(s.id)) && pairs.every((x) => p.pairs.includes(x.id));
}
