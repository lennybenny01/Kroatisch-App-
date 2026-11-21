import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../lib/platform';
import { getRecognitionCtor, listen, normalizeErrorCode, RecognitionError, type RecognitionCtor, type SpeechRecognitionLike } from '../lib/recognition';
import { bestShadowingScore, checkSpokenAnswer, digitsToWords, shadowingScore } from './speechCheck';
import { speechHint } from './speechHints';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const ANDROID_SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('checkSpokenAnswer', () => {
  it('accepts the recognised word regardless of case and punctuation', () => {
    expect(checkSpokenAnswer(['Kavu.'], ['kavu'], 'hr')).toMatchObject({ verdict: 'correct', heard: 'Kavu.' });
  });

  it('picks the best of several alternatives', () => {
    const r = checkSpokenAnswer(['kao', 'kava', 'kavu'], ['kavu'], 'hr');
    expect(r.verdict).toBe('correct');
    expect(r.heard).toBe('kavu');
  });

  it('dictionary form in a cloze is "almost" (form), like typing', () => {
    expect(checkSpokenAnswer(['kava'], ['kavu'], 'hr', 'kava').verdict).toBe('form');
  });

  it('recognised digits count as number words', () => {
    expect(checkSpokenAnswer(['5'], ['pet'], 'hr').verdict).toBe('correct');
    expect(checkSpokenAnswer(['12'], ['dvanaest'], 'hr').verdict).toBe('correct');
    expect(checkSpokenAnswer(['2'], ['zwei'], 'de').verdict).toBe('correct');
  });

  it('German answers keep their typo tolerance and article stripping', () => {
    expect(checkSpokenAnswer(['der Kaffee'], ['Kaffee'], 'de').verdict).toBe('correct');
  });

  it('nothing recognised is wrong', () => {
    expect(checkSpokenAnswer([], ['kavu'], 'hr').verdict).toBe('wrong');
    expect(checkSpokenAnswer(['   '], ['kavu'], 'hr').verdict).toBe('wrong');
  });

  it('digitsToWords only replaces known numbers', () => {
    expect(digitsToWords('Imam 5 minuta i 77 eura', 'hr')).toBe('Imam pet minuta i 77 eura');
  });
});

describe('shadowingScore', () => {
  it('perfect repetition scores 1', () => {
    const s = shadowingScore('Pijem kavu s mlijekom.', 'pijem kavu s mlijekom');
    expect(s.score).toBe(1);
    expect(s.words.every((w) => w.ok)).toBe(true);
  });

  it('marks missing and wrong words', () => {
    const s = shadowingScore('Pijem kavu s mlijekom.', 'pijem kava mlijekom');
    expect(s.words.map((w) => w.ok)).toEqual([true, false, false, true]);
    expect(s.score).toBe(0.5);
  });

  it('ignores diacritics and digits', () => {
    expect(shadowingScore('Imam pet minuta.', 'imam 5 minuta').score).toBe(1);
    expect(shadowingScore('Čaj bez šećera.', 'caj bez secera').score).toBe(1);
  });

  it('keeps the original spelling for display', () => {
    expect(shadowingScore('Kako si?', 'kako si').words.map((w) => w.word)).toEqual(['Kako', 'si?']);
  });

  it('best of alternatives', () => {
    expect(bestShadowingScore('Hvala lijepa!', ['hvala lepa', 'hvala lijepa']).score).toBe(1);
  });
});

describe('detectPlatform', () => {
  it.each([
    [IPHONE_SAFARI, 'ios', 'safari'],
    [IPHONE_CHROME, 'ios', 'chrome'],
    [ANDROID_CHROME, 'android', 'chrome'],
    [ANDROID_SAMSUNG, 'android', 'samsung'],
    [ANDROID_FIREFOX, 'android', 'firefox'],
  ])('%s', (ua, platform, browser) => {
    expect(detectPlatform(ua)).toMatchObject({ platform, browser });
  });

  it('iPad pretending to be a Mac is iOS', () => {
    expect(detectPlatform(IPAD, false, 5).platform).toBe('ios');
    expect(detectPlatform(IPAD, false, 0).platform).toBe('desktop');
  });
});

describe('speechHint', () => {
  const ios = detectPlatform(IPHONE_SAFARI);
  const iosApp = detectPlatform(IPHONE_SAFARI, true);
  const android = detectPlatform(ANDROID_CHROME);
  const samsung = detectPlatform(ANDROID_SAMSUNG);

  it('missing Croatian voice: device-specific install steps and a fallback', () => {
    expect(speechHint({ kind: 'tts-no-voice' }, ios).steps).toMatch(/Bedienungshilfen → Gesprochene Inhalte → Stimmen → Kroatisch/);
    expect(speechHint({ kind: 'tts-no-voice' }, android).steps).toMatch(/Google-Sprachausgabe/);
    expect(speechHint({ kind: 'tts-no-voice' }, ios).fallback).toBeTruthy();
  });

  it('no recognition: iPhone app vs Safari, Android Samsung → Chrome', () => {
    expect(speechHint({ kind: 'recognition-unsupported' }, iosApp).steps).toMatch(/Safari/);
    expect(speechHint({ kind: 'recognition-unsupported' }, ios).steps).toMatch(/Diktierfunktion/);
    expect(speechHint({ kind: 'recognition-unsupported' }, samsung).steps).toMatch(/Chrome/);
    expect(speechHint({ kind: 'recognition-unsupported' }, android).fallback).toMatch(/eintippen/);
  });

  it('every recognition error gives a German title and a typing fallback', () => {
    for (const code of ['not-allowed', 'service-not-allowed', 'network', 'no-speech', 'audio-capture', 'language-not-supported', 'unsupported', 'aborted', 'unknown'] as const) {
      for (const p of [ios, android]) {
        const h = speechHint({ kind: 'recognition-error', code }, p);
        expect(h.title.length).toBeGreaterThan(3);
        expect(h.fallback).toBeTruthy();
      }
    }
    expect(speechHint({ kind: 'recognition-error', code: 'not-allowed' }, ios).steps).toMatch(/Safari → Mikrofon/);
    expect(speechHint({ kind: 'recognition-error', code: 'network' }, android).body).toMatch(/Internet/);
  });
});

/** Fake recogniser that plays back a scripted outcome. */
function fakeRecognition(script: { alternatives?: string[]; error?: string; silent?: boolean }): RecognitionCtor & { last?: SpeechRecognitionLike } {
  const Ctor = class implements SpeechRecognitionLike {
    lang = '';
    continuous = true;
    interimResults = true;
    maxAlternatives = 1;
    onresult: SpeechRecognitionLike['onresult'] = null;
    onerror: SpeechRecognitionLike['onerror'] = null;
    onend: SpeechRecognitionLike['onend'] = null;
    constructor() {
      (Ctor as unknown as { last: SpeechRecognitionLike }).last = this;
    }
    start() {
      queueMicrotask(() => {
        if (script.error) this.onerror?.({ error: script.error });
        else if (script.alternatives) {
          const r = Object.assign(script.alternatives.map((t, i) => ({ transcript: t, confidence: 1 - i * 0.1 })), { isFinal: true });
          this.onresult?.({ results: [r] });
        }
        if (!script.silent) this.onend?.();
      });
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onerror?.({ error: 'aborted' });
    }
  };
  return Ctor as unknown as RecognitionCtor & { last?: SpeechRecognitionLike };
}

describe('listen (speech recognition wrapper)', () => {
  it('configures hr-HR with several alternatives and returns them', async () => {
    const Ctor = fakeRecognition({ alternatives: ['kavu', 'kava'] });
    const s = listen('hr-HR', { Ctor });
    await expect(s.result).resolves.toEqual(['kavu', 'kava']);
    expect(Ctor.last!.lang).toBe('hr-HR');
    expect(Ctor.last!.maxAlternatives).toBe(5);
    expect(Ctor.last!.continuous).toBe(false);
  });

  it.each([
    ['not-allowed', 'not-allowed'],
    ['service-not-allowed', 'service-not-allowed'],
    ['network', 'network'],
    ['language-not-supported', 'language-not-supported'],
    ['something-new', 'unknown'],
  ])('maps error %s → %s', async (raw, code) => {
    const s = listen('hr-HR', { Ctor: fakeRecognition({ error: raw }) });
    await expect(s.result).rejects.toMatchObject({ code });
  });

  it('ending without a result counts as no-speech', async () => {
    const s = listen('hr-HR', { Ctor: fakeRecognition({}) });
    await expect(s.result).rejects.toBeInstanceOf(RecognitionError);
    await expect(s.result).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('stops by itself after the timeout', async () => {
    const s = listen('hr-HR', { Ctor: fakeRecognition({ silent: true }), timeoutMs: 20 });
    await expect(s.result).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('missing API → unsupported', async () => {
    expect(getRecognitionCtor({})).toBeUndefined();
    await expect(listen('hr-HR', { Ctor: undefined }).result).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('prefers the standard constructor over the webkit prefix', () => {
    const A = fakeRecognition({});
    const B = fakeRecognition({});
    expect(getRecognitionCtor({ SpeechRecognition: A, webkitSpeechRecognition: B })).toBe(A);
    expect(getRecognitionCtor({ webkitSpeechRecognition: B })).toBe(B);
    expect(normalizeErrorCode('bad-grammar')).toBe('unknown');
  });
});

describe('pickShadowingSentences', async () => {
  const { pickShadowingSentences } = await import('./shadowing');
  const { sampleContent } = await import('../content/fixtures/sample');
  const { freshCards } = await import('./testUtils');
  const { CardState } = await import('./types');

  it('nothing learned yet → first sentences of the course', () => {
    const s = pickShadowingSentences(sampleContent.sentences, freshCards(), 3);
    expect(s.map((x) => x.id)).toEqual(sampleContent.sentences.slice(0, 3).map((x) => x.id));
  });

  it('only sentences whose words have all been seen', () => {
    const seen = new Set(['w_molim', 'w_kava']);
    const cards = freshCards().map((c) => (c.kind === 'recognize' && seen.has(c.wordId) ? { ...c, state: CardState.Review } : c));
    const s = pickShadowingSentences(sampleContent.sentences, cards, 5);
    expect(s.map((x) => x.id)).toEqual(['s_kavu']);
  });
});
