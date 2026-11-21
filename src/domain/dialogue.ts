import { checkAnswer, foldDiacritics, normalize, type AnswerLang } from './answerCheck';
import { digitsToWords } from './speechCheck';

// ---------- Content model ----------

export interface PartnerTurn {
  speaker: 'partner';
  hr: string;
  de: string;
}

export interface UserTurn {
  speaker: 'user';
  /** Task in German, e.g. „Bestelle einen Kaffee mit Milch.“ */
  task: string;
  /** Model answers; "*" stands for any 1–3 words (e.g. a name or a number). The first one is shown as suggestion. */
  answers: string[];
  /**
   * Groups of word stems that must appear – one alternative per group is enough.
   * Stems match inflected forms: "kav" matches kava, kavu, kave.
   */
  keywords: string[][];
}

export type DialogueTurn = PartnerTurn | UserTurn;

export interface Dialogue {
  id: string;
  unitId: string;
  title: string;
  /** Where and with whom – shown before the dialogue starts. */
  setting: string;
  partner: string;
  turns: DialogueTurn[];
}

// ---------- Checking free answers ----------

export type DialogueVerdict = 'perfect' | 'good' | 'partial' | 'miss';

export interface DialogueCheck {
  verdict: DialogueVerdict;
  /** 0–1 */
  score: number;
  /** Keyword groups that were not found (first alternative each). */
  missing: string[];
  /** Model answer to show. */
  model: string;
  /** The answer variant the input matched, if any. */
  matched?: string;
}

const SCORE: Record<DialogueVerdict, number> = { perfect: 1, good: 0.8, partial: 0.4, miss: 0 };

const fold = (s: string) => foldDiacritics(normalize(s));

/** "Zovem se *." → regex over the folded, normalised input. */
function wildcardRegex(answer: string): RegExp {
  const parts = fold(answer.replace(/\*/g, ' __any__ '))
    .split(' ')
    .filter(Boolean)
    .map((t) => (t === '__any__' ? '\\S+(?: \\S+){0,2}' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  return new RegExp(`^${parts.join(' ')}$`);
}

/** Does the input contain the stem (single word: a token starting with it; phrase: contained as words)? */
export function hasKeyword(foldedInput: string, keyword: string): boolean {
  const k = fold(keyword);
  if (!k) return false;
  if (k.includes(' ')) return ` ${foldedInput} `.includes(` ${k}`);
  return foldedInput.split(' ').some((t) => t.startsWith(k));
}

/**
 * Checks a free answer in a dialogue:
 * - perfect: matches one of the model answers (tolerant: case, punctuation, diacritics)
 * - good: all keyword groups present – understood, the model shows the typical wording
 * - partial: some keywords present
 * - miss: none
 */
export function checkDialogueAnswer(input: string, turn: UserTurn, lang: AnswerLang = 'hr'): DialogueCheck {
  const text = digitsToWords(input, lang);
  const folded = fold(text);
  const model = turn.answers[0] ?? '';
  if (!folded) return { verdict: 'miss', score: 0, missing: turn.keywords.map((g) => g[0]!), model };

  for (const a of turn.answers) {
    if (a.includes('*')) {
      if (wildcardRegex(a).test(folded)) return { verdict: 'perfect', score: 1, missing: [], model, matched: a };
    } else {
      const v = checkAnswer({ input: text, expected: [a], lang }).verdict;
      if (v === 'correct' || v === 'diacritics') return { verdict: 'perfect', score: 1, missing: [], model, matched: a };
    }
  }

  const missing = turn.keywords.filter((group) => !group.some((k) => hasKeyword(folded, k))).map((g) => g[0]!);
  const found = turn.keywords.length - missing.length;
  const verdict: DialogueVerdict =
    turn.keywords.length > 0 && missing.length === 0 ? 'good' : found > 0 ? 'partial' : 'miss';
  return { verdict, score: SCORE[verdict], missing, model };
}

/** Best result over several speech-recognition alternatives. */
export function checkDialogueAlternatives(alternatives: readonly string[], turn: UserTurn): DialogueCheck & { heard: string } {
  let best = { ...checkDialogueAnswer(alternatives[0] ?? '', turn), heard: alternatives[0] ?? '' };
  for (const a of alternatives.slice(1)) {
    const r = checkDialogueAnswer(a, turn);
    if (r.score > best.score) best = { ...r, heard: a };
  }
  return best;
}

/** Overall result of a dialogue (average of the best attempt per user turn). */
export function dialogueScore(scores: readonly number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}
