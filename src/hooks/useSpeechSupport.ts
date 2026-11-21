import { useMemo } from 'react';
import { currentPlatform, type PlatformInfo } from '../lib/platform';
import { recognitionSupported } from '../lib/recognition';
import { recordingSupported } from '../lib/recorder';
import { useCroatianVoice, type VoiceStatus } from './useCroatianVoice';

export interface SpeechSupport {
  platform: PlatformInfo;
  /** Croatian text-to-speech. */
  tts: VoiceStatus;
  /** Speech recognition API present (whether hr-HR works only shows on use). */
  recognition: boolean;
  recording: boolean;
  /** Can we play Croatian audio? */
  canSpeak: boolean;
}

export function useSpeechSupport(): SpeechSupport {
  const tts = useCroatianVoice();
  return useMemo(
    () => ({
      platform: currentPlatform(),
      tts,
      recognition: recognitionSupported(),
      recording: recordingSupported(),
      canSpeak: tts === 'available',
    }),
    [tts],
  );
}
