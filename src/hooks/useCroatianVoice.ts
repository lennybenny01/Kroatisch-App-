import { useEffect, useState } from 'react';
import { findVoice, ttsSupported } from '../lib/tts';

export type VoiceStatus = 'unsupported' | 'checking' | 'available' | 'missing';

/** Whether a Croatian text-to-speech voice is installed (voices load asynchronously in some browsers). */
export function useCroatianVoice(): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>(() => {
    if (!ttsSupported) return 'unsupported';
    return findVoice('hr-HR') ? 'available' : 'checking';
  });
  useEffect(() => {
    if (!ttsSupported) return;
    const check = () => {
      if (findVoice('hr-HR')) setStatus('available');
      else if (speechSynthesis.getVoices().length > 0) setStatus('missing');
    };
    check();
    speechSynthesis.addEventListener('voiceschanged', check);
    // Some browsers never fire voiceschanged – decide after a moment.
    const t = setTimeout(() => setStatus((s) => (s === 'checking' ? (findVoice('hr-HR') ? 'available' : 'missing') : s)), 1500);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', check);
      clearTimeout(t);
    };
  }, []);
  return status;
}
