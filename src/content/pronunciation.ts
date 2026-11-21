import data from './pronunciation.json';

export interface PronExample {
  hr: string;
  de: string;
}

export interface PronItem {
  /** Full word, e.g. "čaj". */
  word: string;
  /** Word with the sound replaced by "_", e.g. "_aj". */
  blank: string;
  de: string;
}

export interface PronSound {
  id: string;
  letter: string;
  summary: string;
  explanation: string;
  compare: { word: string; hint: string };
  examples: PronExample[];
  /** Answer options for the listening exercise; the correct one is `letter`. */
  options: string[];
  items: PronItem[];
}

export interface PronPairSide {
  letter: string;
  label: string;
  how: string;
  words: PronExample[];
}

export interface PronPair {
  id: string;
  title: string;
  explanation: string;
  left: PronPairSide;
  right: PronPairSide;
  tip: string;
}

export interface Pronunciation {
  intro: {
    spelling: { title: string; body: string[] };
    stress: { title: string; body: string[]; examples: { syllables: string[]; stressed: number; hr: string; de: string }[] };
    others: { letter: string; text: string; hr: string; de: string }[];
  };
  sounds: PronSound[];
  pairs: PronPair[];
}

export const pronunciation = data as Pronunciation;
