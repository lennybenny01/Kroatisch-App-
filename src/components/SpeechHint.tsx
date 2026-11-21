import { speechHint, type SpeechProblem } from '../domain/speechHints';
import { useSpeechSupport } from '../hooks/useSpeechSupport';

/** Understandable, device-specific explanation when audio or the microphone does not work. */
export function SpeechHint({ problem, onClose, compact = false }: { problem: SpeechProblem; onClose?: () => void; compact?: boolean }) {
  const { platform } = useSpeechSupport();
  const h = speechHint(problem, platform);
  return (
    <div className="feedback almost speech-hint" role="note">
      <div className="speech-hint-head">
        <div className="feedback-title">{h.title}</div>
        {onClose && (
          <button type="button" className="hint-close" aria-label="Hinweis schließen" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <div className="feedback-body">
        {h.body}
        {!compact && h.steps && <div className="hint-steps">{h.steps}</div>}
        <div className="hint-fallback">👉 {h.fallback}</div>
      </div>
    </div>
  );
}
