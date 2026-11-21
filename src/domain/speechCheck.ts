import { checkAnswer, foldDiacritics, normalize, type AnswerLang, type CheckResult } from './answerCheck';
import type { AnswerVerdict } from './types';

/**
 * Speech recognisers often write numbers as digits ("5" instead of "pet").
 * Map them back to words so spoken answers can be compared with the course.
 */
const NUMBERS: Record<AnswerLang, Record<string, string>> = {
  hr: {
    '0': 'nula', '1': 'jedan', '2': 'dva', '3': 'tri', '4': 'četiri', '5': 'pet', '6': 'šest', '7': 'sedam', '8': 'osam',
    '9': 'devet', '10': 'deset', '11': 'jedanaest', '12': 'dvanaest', '13': 'trinaest', '14': 'četrnaest', '15': 'petnaest',
    '20': 'dvadeset', '30': 'trideset', '40': 'četrdeset', '50': 'pedeset', '100': 'sto', '1000': 'tisuću',
  },
  de: {
    '0': 'null', '1': 'eins', '2': 'zwei', '3': 'drei', '4': 'vier', '5': 'fünf', '6': 'sechs', '7': 'sieben', '8': 'acht',
    '9': 'neun', '10': 'zehn', '11': 'elf', '12': 'zwölf', '13': 'dreizehn', '14': 'vierzehn', '15': 'fünfzehn',
    '20': 'zwanzig', '30': 'dreißig', '40': 'vierzig', '50': 'fünfzig', '100': 'hundert', '1000': 'tausend',
  },
};

/** "Imam 5 minuta." → "Imam pet minuta." */
export function digitsToWords(text: string, lang: AnswerLang): string {
  return text.replace(/\d+/g, (d) => NUMBERS[lang][d] ?? d);
}

const RANK: Record<AnswerVerdict, number> = { correct: 4, diacritics: 3, typo: 3, form: 2, wrong: 0 };

export interface SpokenResult extends CheckResult {
  /** The recognised alternative that matched best – shown as "Erkannt: …". */
  heard: string;
}

/**
 * Checks a spoken answer. The recogniser delivers several alternatives
 * ("kavu", "kava", "kao") – the best-matching one counts.
 */
export function checkSpokenAnswer(
  alternatives: readonly string[],
  expected: readonly string[],
  lang: AnswerLang,
  lemma?: string,
): SpokenResult {
  let best: SpokenResult = { verdict: 'wrong', solution: expected[0] ?? '', heard: alternatives[0] ?? '' };
  for (const alt of alternatives) {
    const heard = digitsToWords(alt, lang).trim();
    if (!heard) continue;
    const r = checkAnswer({ input: heard, expected, lang, lemma });
    if (RANK[r.verdict] > RANK[best.verdict]) best = { ...r, heard };
    if (r.verdict === 'correct') break;
  }
  return best;
}

export interface ShadowWord {
  word: string;
  ok: boolean;
}

export interface ShadowScore {
  /** 0–1: share of the sentence's words that were recognised, in order. */
  score: number;
  words: ShadowWord[];
}

const words = (s: string) => normalize(s).split(' ').filter(Boolean);

/**
 * Compares a sentence with what the recogniser heard (longest common
 * subsequence of words, ignoring case, punctuation and diacritics).
 */
export function shadowingScore(sentence: string, heard: string, lang: AnswerLang = 'hr'): ShadowScore {
  const display = sentence.split(/\s+/).filter(Boolean);
  const exp = display.map((w) => foldDiacritics(normalize(w)));
  const got = words(digitsToWords(heard, lang)).map(foldDiacritics);
  // LCS table
  const dp = Array.from({ length: exp.length + 1 }, () => new Array<number>(got.length + 1).fill(0));
  for (let i = exp.length - 1; i >= 0; i--)
    for (let j = got.length - 1; j >= 0; j--)
      dp[i]![j] = exp[i] === got[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const ok = new Array<boolean>(exp.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < exp.length && j < got.length) {
    if (exp[i] === got[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const countable = exp.filter((w) => w.length > 0).length || 1;
  return {
    score: ok.filter((v, k) => v && exp[k]!.length > 0).length / countable,
    words: display.map((w, k) => ({ word: w, ok: ok[k]! || exp[k]!.length === 0 })),
  };
}

/** Best score over all recogniser alternatives. */
export function bestShadowingScore(sentence: string, alternatives: readonly string[], lang: AnswerLang = 'hr'): ShadowScore & { heard: string } {
  let best = { ...shadowingScore(sentence, alternatives[0] ?? '', lang), heard: alternatives[0] ?? '' };
  for (const a of alternatives.slice(1)) {
    const s = shadowingScore(sentence, a, lang);
    if (s.score > best.score) best = { ...s, heard: a };
  }
  return best;
}
