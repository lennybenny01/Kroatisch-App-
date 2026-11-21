import { Rating, type AnswerVerdict } from './types';

export type AnswerLang = 'hr' | 'de';

const PUNCTUATION = /[.,!?;:"'„“”‚‘’«»()[\]¡¿…–—-]/g;

/** Lower-case, unify Unicode, drop punctuation and surplus whitespace. */
export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
}

const FOLD: Record<string, string> = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd', ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };

/** Removes Croatian (and German) diacritics: "kuća" → "kuca". Expects normalized input. */
export function foldDiacritics(s: string): string {
  return s.replace(/[čćšžđäöüß]/g, (ch) => FOLD[ch] ?? ch);
}

const GERMAN_ARTICLE = /^(der|die|das|den|dem|ein|eine|einen|einem|einer)\s+/;

/** All spellings we accept for one expected answer. */
function variants(expected: string, lang: AnswerLang): string[] {
  const out = new Set<string>();
  const add = (v: string) => {
    const n = normalize(v);
    if (n) out.add(n);
  };
  add(expected);
  // "(sich) freuen" → accept with and without the bracketed part
  if (expected.includes('(')) add(expected.replace(/\([^)]*\)/g, ' '));
  if (lang === 'de') for (const v of [...out]) add(v.replace(GERMAN_ARTICLE, ''));
  return [...out];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Allowed typos in German answers by word length. Croatian gets none: one letter is often grammar (kava/kavu). */
export function typoTolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

const RANK: Record<AnswerVerdict, number> = { correct: 4, diacritics: 3, typo: 3, form: 2, wrong: 0 };

export interface CheckInput {
  input: string;
  /** All accepted answers; the first one is the canonical solution. */
  expected: readonly string[];
  lang: AnswerLang;
  /** Cloze only: dictionary form of the expected (inflected) word. */
  lemma?: string;
}

export interface CheckResult {
  verdict: AnswerVerdict;
  /** The accepted answer closest to the input – show this as the correct spelling. */
  solution: string;
}

function checkSingle(input: string, expected: readonly string[], lang: AnswerLang, lemma?: string): CheckResult {
  const inNorm = lang === 'de' ? normalize(input).replace(GERMAN_ARTICLE, '') : normalize(input);
  const inFold = foldDiacritics(inNorm);
  let best: CheckResult = { verdict: 'wrong', solution: expected[0] ?? '' };
  const consider = (verdict: AnswerVerdict, solution: string) => {
    if (RANK[verdict] > RANK[best.verdict]) best = { verdict, solution };
  };
  if (!inNorm) return best;

  for (const exp of expected) {
    for (const v of variants(exp, lang)) {
      if (inNorm === v) return { verdict: 'correct', solution: exp };
      const vFold = foldDiacritics(v);
      if (inFold === vFold) consider('diacritics', exp);
      else if (lang === 'de' && levenshtein(inFold, vFold) <= typoTolerance(vFold.length)) consider('typo', exp);
    }
  }
  if (lemma && best.verdict === 'wrong') {
    const l = foldDiacritics(normalize(lemma));
    if (inFold === l) consider('form', expected[0] ?? '');
  }
  return best;
}

/**
 * Checks a typed answer. Several meanings may be entered separated by "," ";"
 * or "/" – each must be acceptable, the weakest one decides the verdict.
 */
export function checkAnswer({ input, expected, lang, lemma }: CheckInput): CheckResult {
  const whole = checkSingle(input, expected, lang, lemma);
  if (whole.verdict === 'correct') return whole;
  const parts = input.split(/[,;/]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return whole;
  const results = parts.map((p) => checkSingle(p, expected, lang, lemma));
  const worst = results.reduce((w, r) => (RANK[r.verdict] < RANK[w.verdict] ? r : w));
  return RANK[worst.verdict] > RANK[whole.verdict] ? worst : whole;
}

/** Which rating button to highlight after checking. The user still decides. */
export function suggestRating(verdict: AnswerVerdict, strictDiacritics = false): Rating {
  switch (verdict) {
    case 'correct':
      return Rating.Good;
    case 'diacritics':
      return strictDiacritics ? Rating.Again : Rating.Hard;
    case 'typo':
    case 'form':
      return Rating.Hard;
    default:
      return Rating.Again;
  }
}

export function isAcceptable(verdict: AnswerVerdict, strictDiacritics = false): boolean {
  return suggestRating(verdict, strictDiacritics) !== Rating.Again;
}
