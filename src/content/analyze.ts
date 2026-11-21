import type { Word } from '../domain/types';

export interface Token {
  text: string;
  norm: string;
  start: number;
  end: number;
}

export interface WordMatch {
  wordId: string;
  /** Character range in the sentence (covers multi-word phrases). */
  start: number;
  end: number;
}

export interface SentenceAnalysis {
  matches: WordMatch[];
  /** Tokens that are neither course vocabulary nor known names. */
  unknown: string[];
}

const norm = (s: string) => s.normalize('NFC').toLowerCase();

export function tokenize(text: string): Token[] {
  return [...text.normalize('NFC').matchAll(/\p{L}+/gu)].map((m) => ({
    text: m[0],
    norm: norm(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

export interface FormIndex {
  forms: Map<string, string[]>;
  maxTokens: number;
  order: Map<string, number>;
}

/** Maps every lemma/alternative/inflected form (also multi-word) to the words it can belong to. */
export function buildFormIndex(words: readonly Word[]): FormIndex {
  const forms = new Map<string, string[]>();
  let maxTokens = 1;
  const add = (form: string, id: string) => {
    const key = tokenize(form).map((t) => t.norm).join(' ');
    if (!key) return;
    maxTokens = Math.max(maxTokens, key.split(' ').length);
    const list = forms.get(key) ?? [];
    if (!list.includes(id)) list.push(id);
    forms.set(key, list);
  };
  for (const w of words) {
    add(w.hr, w.id);
    w.hrAlt?.forEach((f) => add(f, w.id));
    w.forms?.forEach((f) => add(f, w.id));
  }
  return { forms, maxTokens, order: new Map(words.map((w) => [w.id, w.order])) };
}

/**
 * Splits a sentence into course words: greedy longest match (so phrases like
 * "dobar dan" win over single words). Ambiguous forms resolve to the word
 * introduced first.
 */
export function analyzeSentence(text: string, index: FormIndex, names: ReadonlySet<string>): SentenceAnalysis {
  const tokens = tokenize(text);
  const matches: WordMatch[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let len = Math.min(index.maxTokens, tokens.length - i); len >= 1; len--) {
      const key = tokens.slice(i, i + len).map((t) => t.norm).join(' ');
      const candidates = index.forms.get(key);
      if (!candidates) continue;
      const wordId = [...candidates].sort((a, b) => (index.order.get(a) ?? 0) - (index.order.get(b) ?? 0))[0]!;
      matches.push({ wordId, start: tokens[i]!.start, end: tokens[i + len - 1]!.end });
      i += len;
      matched = true;
      break;
    }
    if (!matched) {
      const t = tokens[i]!;
      if (!names.has(t.text)) unknown.push(t.text);
      i++;
    }
  }
  return { matches, unknown };
}
