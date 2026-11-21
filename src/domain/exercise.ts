import { shuffle, type Rng } from '../lib/random';
import type { AnswerLang } from './answerCheck';
import { CardState, type CardDef, type SchedulingState, type Sentence, type Translation, type Word } from './types';

export type ExerciseMode = 'choice' | 'type';

export interface Exercise {
  cardId: string;
  kind: CardDef['kind'];
  mode: ExerciseMode;
  /** Short label above the prompt. */
  label: string;
  /** Main prompt text. For cloze: the sentence with "___". */
  prompt: string;
  /** Language of the prompt (for text-to-speech). */
  promptLang: AnswerLang;
  /** Secondary line, e.g. the German translation of a cloze sentence. */
  hint?: string;
  answerLang: AnswerLang;
  expected: string[];
  lemma?: string;
  /** Multiple-choice options (only for mode "choice"). */
  choices?: string[];
  /** Shown after answering. */
  word: Word;
  sentence?: Sentence;
  /** Free translation: the exercise and its key words. */
  translation?: Translation;
}

export interface ContentLookup {
  words: readonly Word[];
  sentences: readonly Sentence[];
  wordById: ReadonlyMap<string, Word>;
  sentenceById: ReadonlyMap<string, Sentence>;
  translationById?: ReadonlyMap<string, Translation>;
}

/** Multiple choice only on the very first contact with a new card, afterwards always active recall. Free translations are always typed. */
export function exerciseMode(card: Pick<SchedulingState, 'state'> & { kind?: CardDef['kind'] }): ExerciseMode {
  if (card.kind === 'translate') return 'type';
  return card.state === CardState.New ? 'choice' : 'type';
}

export const BLANK = '＿＿＿';

export function blankOut(sentence: string, form: string, start?: number): string {
  const idx = start !== undefined && sentence.slice(start, start + form.length) === form ? start : sentence.indexOf(form);
  if (idx < 0) return sentence;
  return sentence.slice(0, idx) + BLANK + sentence.slice(idx + form.length);
}

/** First `n` unique entries of `pool` that differ from the correct answer (pool order = preference). */
function pickDistractors(correct: string, pool: readonly string[], n: number): string[] {
  const seen = new Set([correct.toLowerCase()]);
  const out: string[] = [];
  for (const p of pool) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

export function buildExercise(
  def: CardDef,
  state: Pick<SchedulingState, 'state'>,
  content: ContentLookup,
  rng: Rng = Math.random,
): Exercise {
  if (def.kind === 'translate') {
    const t = def.translationId ? content.translationById?.get(def.translationId) : undefined;
    if (!t) throw new Error(`Unknown translation ${def.translationId}`);
    const w = content.wordById.get(def.wordId) ?? ({ id: t.id, unitId: t.unitId, order: 0, hr: t.hr[0]!, de: [t.de], pos: 'phrase' } as Word);
    return {
      cardId: def.id,
      kind: 'translate',
      mode: 'type',
      label: 'Übersetze frei ins Kroatische',
      prompt: t.de,
      promptLang: 'de',
      answerLang: 'hr',
      expected: t.hr,
      word: w,
      translation: t,
    };
  }
  const word = content.wordById.get(def.wordId);
  if (!word) throw new Error(`Unknown word ${def.wordId}`);
  const mode = exerciseMode(state);
  // Distractors only from this and earlier units – never words the learner cannot know yet.
  const unitLimit = (Math.floor(word.order / 1000) + 1) * 1000;
  const known = content.words.filter((w) => w.id !== word.id && w.order < unitLimit);
  const knownIds = new Set(known.map((w) => w.id));
  // Prefer distractors of the same part of speech, fill up with others.
  const ordered = [...shuffle(known.filter((w) => w.pos === word.pos), rng), ...shuffle(known.filter((w) => w.pos !== word.pos), rng)];

  let ex: Omit<Exercise, 'choices' | 'mode' | 'cardId' | 'kind'>;
  let pool: string[];
  switch (def.kind) {
    case 'recognize':
      ex = { label: 'Was bedeutet …?', prompt: word.hr, promptLang: 'hr', answerLang: 'de', expected: word.de, word };
      pool = ordered.map((w) => w.de[0]!);
      break;
    case 'produce':
      ex = {
        label: 'Wie sagt man auf Kroatisch …?',
        prompt: word.de.join(' / '),
        promptLang: 'de',
        answerLang: 'hr',
        expected: [word.hr, ...(word.hrAlt ?? [])],
        word,
      };
      pool = ordered.map((w) => w.hr);
      break;
    case 'cloze': {
      const sentence = def.sentenceId ? content.sentenceById.get(def.sentenceId) : undefined;
      if (!sentence) throw new Error(`Unknown sentence ${def.sentenceId}`);
      ex = {
        label: 'Ergänze die Lücke',
        prompt: blankOut(sentence.hr, sentence.clozeForm, sentence.clozeStart),
        promptLang: 'hr',
        hint: sentence.de,
        answerLang: 'hr',
        expected: [sentence.clozeForm],
        lemma: word.hr !== sentence.clozeForm.toLowerCase() ? word.hr : undefined,
        word,
        sentence,
      };
      // The dictionary form is the most instructive distractor ("kava" vs. "kavu").
      // Same part of speech first (other inflected forms, then lemmas), the rest after.
      const formsOf = (pred: (w: Word) => boolean) =>
        content.sentences.filter((s) => knownIds.has(s.clozeWordId) && pred(content.wordById.get(s.clozeWordId)!)).map((s) => s.clozeForm);
      const same = (w: Word) => w.pos === word.pos;
      pool = [
        ...shuffle([...formsOf(same), ...ordered.filter(same).map((w) => w.hr)], rng),
        ...shuffle([...formsOf((w) => !same(w)), ...ordered.filter((w) => !same(w)).map((w) => w.hr)], rng),
      ];
      break;
    }
  }

  const base: Exercise = { ...ex, cardId: def.id, kind: def.kind, mode };
  if (mode === 'choice') {
    const correct = ex.expected[0]!;
    // The dictionary form is the most instructive cloze distractor ("kava" vs. "kavu").
    const preferred = ex.lemma ? [ex.lemma] : [];
    let options = [correct, ...pickDistractors(correct, [...preferred, ...pool], 3)];
    if (def.kind === 'cloze' && ex.sentence) {
      // Same capitalisation for all options, otherwise the sentence start gives the answer away.
      const atStart = ex.sentence.clozeStart === 0;
      const fmt = (o: string) => (atStart ? o.charAt(0).toUpperCase() + o.slice(1) : o.toLowerCase());
      options = [...new Map(options.map((o) => [fmt(o), fmt(o)])).values()];
    }
    base.choices = shuffle(options, rng);
  }
  return base;
}
