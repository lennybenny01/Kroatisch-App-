/** Text-to-speech via the Web Speech API (works offline with installed voices, e.g. on iOS). */
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Speaking rates: normal for flashcards, slow for pronunciation practice. */
export const RATE_NORMAL = 0.9;
export const RATE_SLOW = 0.5;

export function findVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!ttsSupported) return undefined;
  const voices = speechSynthesis.getVoices();
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  return voices.find((v) => norm(v.lang) === lang.toLowerCase()) ?? voices.find((v) => norm(v.lang).startsWith(lang.slice(0, 2).toLowerCase()));
}

function utterance(text: string, lang: 'hr' | 'de', rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const bcp = lang === 'hr' ? 'hr-HR' : 'de-DE';
  u.lang = bcp;
  u.rate = rate;
  const voice = findVoice(bcp);
  if (voice) u.voice = voice;
  return u;
}

export function speak(text: string, lang: 'hr' | 'de' = 'hr', rate = RATE_NORMAL) {
  if (!ttsSupported) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance(text, lang, rate));
}

/** Speaks several words one after another with a short pause (e.g. "čaj … ćevapi"). */
export function speakSequence(texts: string[], rate = RATE_SLOW, pauseMs = 450) {
  if (!ttsSupported) return;
  speechSynthesis.cancel();
  let i = 0;
  const next = () => {
    if (i >= texts.length) return;
    const u = utterance(texts[i++]!, 'hr', rate);
    u.onend = () => setTimeout(next, pauseMs);
    speechSynthesis.speak(u);
  };
  next();
}
