import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBack } from '../../app/icons';
import { MicButton } from '../../components/MicButton';
import { SpeakButtons } from '../../components/SpeakButtons';
import { SpeechHint } from '../../components/SpeechHint';
import { checkSpokenAnswer } from '../../domain/speechCheck';
import type { SpeechProblem } from '../../domain/speechHints';
import { useSpeechSupport } from '../../hooks/useSpeechSupport';
import { startRecording, type Recording } from '../../lib/recorder';
import { findVoice } from '../../lib/tts';

const PLATFORM = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Computer' } as const;
const BROWSER = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', samsung: 'Samsung Internet', edge: 'Edge', other: 'anderer Browser' } as const;

function Status({ ok, children }: { ok: boolean | 'unknown'; children: React.ReactNode }) {
  return (
    <div className="list-item">
      <span aria-hidden className={`status-dot ${ok === true ? 'ok' : ok === false ? 'bad' : 'unknown'}`} />
      <span className="grow">{children}</span>
      <span className="badge">{ok === true ? 'ja' : ok === false ? 'nein' : '?'}</span>
    </div>
  );
}

/** Checks on the user's own device what works: voice, recognition, microphone. */
export function SpeechTestScreen() {
  const navigate = useNavigate();
  const s = useSpeechSupport();
  const [heard, setHeard] = useState<{ text: string; ok: boolean }>();
  const [problem, setProblem] = useState<SpeechProblem>();
  const [rec, setRec] = useState<Recording>();
  const [audio, setAudio] = useState<string>();
  const voice = findVoice('hr-HR');

  return (
    <>
      <div className="page-head">
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="Zurück">
          <IconBack />
        </button>
        <h1 className="page-title">Audio & Mikrofon</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Erkannt: {PLATFORM[s.platform.platform]} · {BROWSER[s.platform.browser]}
        {s.platform.standalone ? ' · als App vom Home-Bildschirm' : ''}
      </p>

      <div className="list">
        <Status ok={s.tts === 'unsupported' ? false : s.tts === 'checking' ? 'unknown' : s.tts === 'available'}>
          Kroatische Stimme{voice ? ` (${voice.name})` : ''}
        </Status>
        <Status ok={s.recognition}>Spracherkennung</Status>
        <Status ok={s.recording}>Aufnahme (für Shadowing)</Status>
      </div>

      <h2 className="section-title">1. Vorlesen</h2>
      {s.tts === 'available' ? (
        <div className="card test-row">
          <span lang="hr">Dobar dan! Kako ste?</span>
          <SpeakButtons text="Dobar dan! Kako ste?" />
        </div>
      ) : (
        s.tts !== 'checking' && <SpeechHint problem={{ kind: s.tts === 'unsupported' ? 'tts-unsupported' : 'tts-no-voice' }} />
      )}

      <h2 className="section-title">2. Spracherkennung</h2>
      {s.recognition ? (
        <div className="card test-col">
          <div>
            Tippe aufs Mikrofon und sag: <strong lang="hr">„Dobar dan“</strong>
          </div>
          <MicButton
            big
            lang="hr-HR"
            label="Test starten"
            onResult={(alts) => {
              const r = checkSpokenAnswer(alts, ['dobar dan'], 'hr');
              setHeard({ text: r.heard, ok: r.verdict === 'correct' || r.verdict === 'diacritics' });
              setProblem(undefined);
            }}
            onError={(code) => {
              setProblem({ kind: 'recognition-error', code });
              setHeard(undefined);
            }}
          />
          {heard && (
            <div className={`feedback ${heard.ok ? 'ok' : 'almost'}`} role="status">
              <div className="feedback-title">{heard.ok ? 'Funktioniert! 🎉' : 'Erkannt, aber etwas anderes'}</div>
              <div className="feedback-body">🎤 „{heard.text}“</div>
            </div>
          )}
        </div>
      ) : (
        <SpeechHint problem={{ kind: 'recognition-unsupported' }} />
      )}
      {problem && <SpeechHint problem={problem} onClose={() => setProblem(undefined)} />}

      <h2 className="section-title">3. Aufnahme</h2>
      {s.recording ? (
        <div className="card test-col">
          <button
            type="button"
            className={`mic-btn big${rec ? ' listening' : ''}`}
            onClick={async () => {
              if (rec) {
                setAudio(await rec.stop());
                setRec(undefined);
                return;
              }
              try {
                setRec(await startRecording());
              } catch (e) {
                setProblem({ kind: 'recording-error', name: e instanceof DOMException ? e.name : 'Error' });
              }
            }}
          >
            {rec ? '⏹ Stopp' : '🎙 Kurz etwas aufnehmen'}
          </button>
          {audio && <audio src={audio} controls style={{ width: '100%' }} />}
        </div>
      ) : (
        <p className="muted">Aufnehmen wird in diesem Browser nicht unterstützt – Shadowing geht dann mit Erkennung oder ohne Mikrofon.</p>
      )}
    </>
  );
}
