import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClose, IconSpeaker } from '../../app/icons';
import { MicButton } from '../../components/MicButton';
import { SpeechHint } from '../../components/SpeechHint';
import { content } from '../../content';
import { db } from '../../db/db';
import { pickShadowingSentences } from '../../domain/shadowing';
import { bestShadowingScore, type ShadowScore } from '../../domain/speechCheck';
import type { SpeechProblem } from '../../domain/speechHints';
import type { Sentence } from '../../domain/types';
import { useSpeechSupport } from '../../hooks/useSpeechSupport';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { startRecording, type Recording } from '../../lib/recorder';
import { RATE_NORMAL, RATE_SLOW, speakAsync, stopSpeaking } from '../../lib/tts';

type Step = 'listen' | 'speak' | 'compare';
type Mode = 'recognize' | 'record' | 'none';

const MODE_LABEL: Record<Mode, string> = { recognize: 'Erkennung', record: 'Aufnahme', none: 'Ohne Mikrofon' };

/** Shadowing: hear the sentence – repeat it – hear it again and compare. */
export function ShadowingScreen() {
  useVisualViewport();
  const navigate = useNavigate();
  const support = useSpeechSupport();
  const [sentences, setSentences] = useState<Sentence[]>();
  const [i, setI] = useState(0);
  const [step, setStep] = useState<Step>('listen');
  const [showText, setShowText] = useState(true);
  const [score, setScore] = useState<ShadowScore & { heard: string }>();
  const [scores, setScores] = useState<number[]>([]);
  const [recording, setRecording] = useState<Recording>();
  const [myAudio, setMyAudio] = useState<string>();
  const [problem, setProblem] = useState<SpeechProblem>();

  const modes = useMemo<Mode[]>(
    () => [...(support.recognition ? (['recognize'] as Mode[]) : []), ...(support.recording ? (['record'] as Mode[]) : []), 'none'],
    [support.recognition, support.recording],
  );
  const [mode, setMode] = useState<Mode>(modes[0]!);

  useEffect(() => {
    void db.cards.toArray().then((cards) => setSentences(pickShadowingSentences(content.sentences, cards, 8)));
    return () => stopSpeaking();
  }, []);

  if (!sentences) return <div className="session" />;
  const s = sentences[i];
  const close = () => navigate('/learn');

  const reset = () => {
    setStep('listen');
    setScore(undefined);
    setProblem(undefined);
    if (myAudio) URL.revokeObjectURL(myAudio);
    setMyAudio(undefined);
  };
  const next = () => {
    reset();
    setI(i + 1);
  };
  const play = (rate: number) => {
    if (!s) return;
    void speakAsync(s.hr, 'hr', rate).then(() => setStep((st) => (st === 'listen' ? 'speak' : st)));
  };
  const onHeard = (alts: string[]) => {
    if (!s) return;
    const r = bestShadowingScore(s.hr, alts);
    setScore(r);
    setScores((x) => [...x, r.score]);
    setStep('compare');
  };
  const toggleRecording = async () => {
    if (recording) {
      const url = await recording.stop();
      setRecording(undefined);
      setMyAudio(url);
      setStep('compare');
      return;
    }
    try {
      stopSpeaking();
      setRecording(await startRecording());
      setProblem(undefined);
    } catch (e) {
      setProblem({ kind: 'recording-error', name: e instanceof DOMException ? e.name : 'Error' });
    }
  };

  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : undefined;

  return (
    <div className="session">
      <header className="session-header">
        <button className="icon-btn" onClick={close} aria-label="Shadowing beenden">
          <IconClose />
        </button>
        <div className="progress-bar" aria-hidden>
          <div style={{ width: `${(i / sentences.length) * 100}%` }} />
        </div>
        <span className="session-count">{s ? `${i + 1}/${sentences.length}` : ''}</span>
      </header>

      {!s ? (
        <div className="session-body">
          <div className="done">
            <div className="done-emoji" aria-hidden>🎧</div>
            <h1 className="page-title">Bravo!</h1>
            <p className="muted">
              {sentences.length} Sätze nachgesprochen{avg !== undefined ? ` · ${avg} % erkannt` : ''}
            </p>
            <button className="btn btn-primary btn-block" onClick={close}>
              Zurück
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="session-body">
            {support.tts !== 'available' && support.tts !== 'checking' && (
              <SpeechHint problem={{ kind: support.tts === 'unsupported' ? 'tts-unsupported' : 'tts-no-voice' }} />
            )}
            <div className="steps" aria-label="Schritte">
              {(['listen', 'speak', 'compare'] as Step[]).map((st, k) => (
                <span key={st} className={`step${step === st ? ' current' : ''}`}>
                  {k + 1}. {st === 'listen' ? 'Hören' : st === 'speak' ? 'Nachsprechen' : 'Vergleichen'}
                </span>
              ))}
            </div>

            <div className="card shadow-card">
              {showText || step === 'compare' ? (
                <div className="shadow-text" lang="hr">
                  {score
                    ? score.words.map((w, k) => (
                        <span key={k} className={w.ok ? 'w-ok' : 'w-miss'}>
                          {w.word}{' '}
                        </span>
                      ))
                    : s.hr}
                </div>
              ) : (
                <div className="shadow-text muted">· · ·</div>
              )}
              <div className="muted">{s.de}</div>
              <label className="shadow-toggle">
                <input type="checkbox" checked={!showText} onChange={(e) => setShowText(!e.target.checked)} /> Text ausblenden (nur hören)
              </label>
            </div>

            {score && (
              <div className={`feedback ${score.score >= 0.8 ? 'ok' : score.score >= 0.5 ? 'almost' : 'bad'}`} role="status">
                <div className="feedback-title">
                  {Math.round(score.score * 100)} % erkannt{score.score >= 0.8 ? ' – super!' : ''}
                </div>
                <div className="feedback-body heard">🎤 Erkannt: „{score.heard}“</div>
              </div>
            )}
            {problem && <SpeechHint problem={problem} onClose={() => setProblem(undefined)} />}
          </div>

          <div className="session-footer">
            {modes.length > 1 && step !== 'compare' && (
              <div className="segmented" role="group" aria-label="Nachsprechen mit">
                {modes.map((m) => (
                  <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            )}
            <div className="footer-row">
              <button type="button" className="btn" onClick={() => play(RATE_NORMAL)} disabled={!support.canSpeak}>
                <IconSpeaker width={20} height={20} /> {step === 'listen' ? 'Hören' : 'Nochmal hören'}
              </button>
              <button type="button" className="btn" onClick={() => play(RATE_SLOW)} disabled={!support.canSpeak}>
                🐢 Langsam
              </button>
            </div>
            {step === 'compare' && myAudio && (
              <audio className="my-audio" src={myAudio} controls aria-label="Meine Aufnahme" />
            )}

            {step !== 'compare' ? (
              mode === 'recognize' ? (
                <MicButton big lang="hr-HR" label="Nachsprechen" onResult={onHeard} onError={(code) => setProblem({ kind: 'recognition-error', code })} />
              ) : mode === 'record' ? (
                <button type="button" className={`mic-btn big${recording ? ' listening' : ''}`} onClick={() => void toggleRecording()}>
                  {recording ? '⏹ Aufnahme beenden' : '🎙 Nachsprechen und aufnehmen'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('compare')}>
                  Laut nachgesprochen ✓
                </button>
              )
            ) : (
              <div className="footer-row">
                <button type="button" className="btn" onClick={reset}>
                  Nochmal versuchen
                </button>
                <button type="button" className="btn btn-primary" onClick={next}>
                  Weiter
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
