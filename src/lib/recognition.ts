/** Speech recognition via the Web Speech API (Chrome: online service; Safari: Siri dictation). */

// Minimal typings – the API is not in TypeScript's DOM lib.
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<RecognitionAlternative> & { isFinal: boolean }>;
}
interface RecognitionErrorEvent {
  error: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(win: unknown = typeof window !== 'undefined' ? window : undefined): RecognitionCtor | undefined {
  const w = win as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
}

export const recognitionSupported = () => !!getRecognitionCtor();

export type RecognitionErrorCode =
  | 'not-allowed' // microphone permission denied
  | 'service-not-allowed' // recogniser disabled (e.g. Siri/dictation off on iOS)
  | 'network' // online recogniser not reachable (Chrome needs internet)
  | 'no-speech' // nothing heard
  | 'audio-capture' // no microphone
  | 'language-not-supported'
  | 'unsupported' // API missing
  | 'aborted'
  | 'unknown';

export class RecognitionError extends Error {
  constructor(public code: RecognitionErrorCode) {
    super(code);
  }
}

export function normalizeErrorCode(raw: string): RecognitionErrorCode {
  const known: RecognitionErrorCode[] = ['not-allowed', 'service-not-allowed', 'network', 'no-speech', 'audio-capture', 'language-not-supported', 'aborted'];
  if (raw === 'bad-grammar') return 'unknown';
  return (known as string[]).includes(raw) ? (raw as RecognitionErrorCode) : 'unknown';
}

export interface RecognitionSession {
  /** Resolves with the alternatives (best first), rejects with RecognitionError. */
  result: Promise<string[]>;
  /** Stop listening and evaluate what was heard so far. */
  stop(): void;
  abort(): void;
}

/**
 * Listens once. Must be called from a tap handler (iOS requires a user gesture).
 */
export function listen(
  lang: 'hr-HR' | 'de-DE',
  { maxAlternatives = 5, timeoutMs = 8000, Ctor = getRecognitionCtor() }: { maxAlternatives?: number; timeoutMs?: number; Ctor?: RecognitionCtor } = {},
): RecognitionSession {
  if (!Ctor) {
    return { result: Promise.reject(new RecognitionError('unsupported')), stop() {}, abort() {} };
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = maxAlternatives;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = new Promise<string[]>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };
    rec.onresult = (e) => {
      const alts: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        for (let k = 0; k < r.length; k++) alts.push(r[k]!.transcript);
      }
      finish(() => (alts.length ? resolve(alts) : reject(new RecognitionError('no-speech'))));
    };
    rec.onerror = (e) => finish(() => reject(new RecognitionError(normalizeErrorCode(e.error))));
    rec.onend = () => finish(() => reject(new RecognitionError('no-speech')));
    timer = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
  });
  try {
    rec.start();
  } catch {
    settled = true;
    return { result: Promise.reject(new RecognitionError('unknown')), stop() {}, abort() {} };
  }
  return {
    result,
    stop: () => rec.stop(),
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
