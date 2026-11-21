import { useEffect, useRef, useState } from 'react';
import { listen, RecognitionError, type RecognitionErrorCode, type RecognitionSession } from '../lib/recognition';
import { stopSpeaking } from '../lib/tts';

export type MicState = 'idle' | 'listening';

const IconMic = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);

/**
 * Tap to speak, tap again to stop early. Starts recognition inside the tap
 * (iOS requires a user gesture) and reports alternatives or an error code.
 */
export function MicButton({
  lang,
  onResult,
  onError,
  big = false,
  label = 'Antwort sprechen',
  disabled = false,
}: {
  lang: 'hr-HR' | 'de-DE';
  onResult: (alternatives: string[]) => void;
  onError: (code: RecognitionErrorCode) => void;
  big?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<MicState>('idle');
  const session = useRef<RecognitionSession | undefined>(undefined);
  useEffect(() => () => session.current?.abort(), []);

  const toggle = () => {
    if (state === 'listening') {
      session.current?.stop();
      return;
    }
    stopSpeaking(); // the app's own voice must not be recognised
    const s = listen(lang);
    session.current = s;
    setState('listening');
    s.result
      .then((alts) => onResult(alts))
      .catch((e: unknown) => onError(e instanceof RecognitionError ? e.code : 'unknown'))
      .finally(() => {
        if (session.current === s) setState('idle');
      });
  };

  return (
    <button
      type="button"
      className={`mic-btn${big ? ' big' : ''}${state === 'listening' ? ' listening' : ''}`}
      onClick={toggle}
      disabled={disabled}
      aria-label={state === 'listening' ? 'Zuhören beenden' : label}
      aria-pressed={state === 'listening'}
    >
      <IconMic size={big ? 28 : 24} />
      {big && <span>{state === 'listening' ? 'Ich höre zu … (tippen zum Beenden)' : label}</span>}
    </button>
  );
}
