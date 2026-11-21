/** Records the microphone (for shadowing: listen to yourself). */
export const recordingSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

function pickMimeType(): string | undefined {
  // Safari records mp4/aac, Chrome webm/opus.
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return undefined;
}

export interface Recording {
  /** Stops recording and resolves with a playable object URL. */
  stop(): Promise<string>;
  cancel(): void;
}

/** Starts recording. Rejects with the DOMException name (e.g. NotAllowedError) on failure. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' })));
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}
