/** Text-to-speech via the Web Speech API (works offline with installed voices, e.g. on iOS). */
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function findVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
    ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
}

export function speak(text: string, lang: 'hr' | 'de' = 'hr', rate = 0.9) {
  if (!ttsSupported) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const bcp = lang === 'hr' ? 'hr-HR' : 'de-DE';
  u.lang = bcp;
  u.rate = rate;
  const voice = findVoice(bcp);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
