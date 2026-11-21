import { IconSpeaker } from '../app/icons';
import { useSpeechSupport } from '../hooks/useSpeechSupport';
import { RATE_NORMAL, RATE_SLOW, speak } from '../lib/tts';

/**
 * Speaker buttons: normal and slow. Rendered only when a voice for the
 * language exists – a German voice reading Croatian would teach wrong sounds.
 */
export function SpeakButtons({
  text,
  lang = 'hr',
  size = 'md',
  label,
}: {
  text: string;
  lang?: 'hr' | 'de';
  size?: 'sm' | 'md';
  label?: string;
}) {
  const { canSpeak, tts } = useSpeechSupport();
  if (lang === 'hr' ? !canSpeak : tts === 'unsupported') return null;
  const px = size === 'sm' ? 18 : 22;
  return (
    <span className={`speak-buttons ${size}`} role="group" aria-label={label ?? 'Vorlesen'}>
      <button type="button" className="speak-btn" aria-label={`„${text}“ vorlesen`} onClick={() => speak(text, lang, RATE_NORMAL)}>
        <IconSpeaker width={px} height={px} />
      </button>
      <button type="button" className="speak-btn slow" aria-label={`„${text}“ langsam vorlesen`} onClick={() => speak(text, lang, RATE_SLOW)}>
        <span aria-hidden>🐢</span>
      </button>
    </span>
  );
}
