import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconClose } from '../../app/icons';
import { MicButton } from '../../components/MicButton';
import { SpeakButtons } from '../../components/SpeakButtons';
import { SpeechHint } from '../../components/SpeechHint';
import { dialogueByUnit } from '../../content/dialogues';
import { db } from '../../db/db';
import { saveDialogueResult } from '../../db/repo';
import {
  checkDialogueAlternatives,
  checkDialogueAnswer,
  dialogueScore,
  type DialogueCheck,
  type DialogueVerdict,
  type PartnerTurn,
  type UserTurn,
} from '../../domain/dialogue';
import type { RecognitionErrorCode } from '../../lib/recognition';
import { useSpeechSupport } from '../../hooks/useSpeechSupport';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { speak, stopSpeaking } from '../../lib/tts';
import { DiacriticsBar } from '../learn/DiacriticsBar';

type LogEntry =
  | { kind: 'partner'; turn: PartnerTurn }
  | { kind: 'user'; turn: UserTurn; answer: string; spoken: boolean; check: DialogueCheck };

const VERDICT: Record<DialogueVerdict, { title: string; tone: string }> = {
  perfect: { title: 'Točno! Genau so.', tone: 'ok' },
  good: { title: 'Gut verstanden!', tone: 'ok' },
  partial: { title: 'Fast – da fehlt noch etwas.', tone: 'almost' },
  miss: { title: 'Nicht ganz.', tone: 'bad' },
};

/** Plays the everyday dialogue at the end of a unit: the partner speaks, you answer by typing or speaking. */
export function DialogueScreen() {
  useVisualViewport();
  const { unitId = '' } = useParams();
  const navigate = useNavigate();
  const dialogue = dialogueByUnit.get(unitId);
  const { recognition, canSpeak } = useSpeechSupport();
  const [started, setStarted] = useState(false);
  const [pos, setPos] = useState(0); // index of the next turn to handle
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [current, setCurrent] = useState<{ check: DialogueCheck; answer: string; spoken: boolean }>();
  const [helped, setHelped] = useState(false);
  const [showText, setShowText] = useState(true);
  const [showDe, setShowDe] = useState<Set<number>>(new Set());
  const [speechError, setSpeechError] = useState<RecognitionErrorCode>();
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (finished && dialogue) void saveDialogueResult(db, dialogue.id, dialogueScore(scores));
  }, [finished, dialogue, scores]);
  useEffect(() => {
    // braces: newer browsers return a Promise from scrollIntoView – an effect must not return it
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log, current, pos]);

  const turn = dialogue?.turns[pos];
  const userTurn = turn?.speaker === 'user' ? turn : undefined;
  const userTotal = useMemo(() => dialogue?.turns.filter((t) => t.speaker === 'user').length ?? 0, [dialogue]);

  if (!dialogue) {
    return (
      <div className="session">
        <div className="session-body">
          <p>Für diese Einheit gibt es noch keinen Dialog.</p>
          <button className="btn" onClick={() => navigate('/learn')}>Zurück</button>
        </div>
      </div>
    );
  }

  /** Shows partner turns from `from` on (speaking the first one) until the next user turn. */
  const advance = (from: number) => {
    const added: LogEntry[] = [];
    let i = from;
    while (i < dialogue.turns.length && dialogue.turns[i]!.speaker === 'partner') {
      added.push({ kind: 'partner', turn: dialogue.turns[i] as PartnerTurn });
      i++;
    }
    if (added.length && canSpeak) speak(added.map((a) => (a.kind === 'partner' ? a.turn.hr : '')).join(' '), 'hr');
    setLog((l) => [...l, ...added]);
    setPos(i);
    setInput('');
    setCurrent(undefined);
    setHelped(false);
    setSpeechError(undefined);
    if (i >= dialogue.turns.length) finish();
  };

  const finish = () => {
    setFinished(true);
  };

  const evaluate = (check: DialogueCheck, answer: string, spoken: boolean) => {
    // Looking at the solution first caps the score.
    const capped = helped ? { ...check, score: Math.min(check.score, 0.5) } : check;
    setCurrent({ check: capped, answer, spoken });
    inputRef.current?.blur();
  };

  const submit = () => {
    if (!userTurn || !input.trim()) return;
    evaluate(checkDialogueAnswer(input, userTurn), input, false);
  };

  const accept = () => {
    if (!userTurn || !current) return;
    setLog((l) => [...l, { kind: 'user', turn: userTurn, answer: current.answer, spoken: current.spoken, check: current.check }]);
    setScores((s) => [...s, current.check.score]);
    advance(pos + 1);
  };

  const retry = () => {
    setCurrent(undefined);
    setInput('');
    inputRef.current?.focus();
  };

  const restart = () => {
    setLog([]);
    setScores([]);
    setFinished(false);
    setPos(0);
    advance(0);
  };

  const close = () => navigate('/learn');
  const done = scores.length;
  const total = Math.round(dialogueScore(scores) * 100);

  return (
    <div className="session dialogue">
      <header className="session-header">
        <button className="icon-btn" onClick={close} aria-label="Dialog beenden">
          <IconClose />
        </button>
        <div className="progress-bar" aria-hidden>
          <div style={{ width: `${(done / Math.max(1, userTotal)) * 100}%` }} />
        </div>
        <span className="session-count">
          {done}/{userTotal}
        </span>
      </header>

      {!started ? (
        <div className="session-body">
          <div className="dialogue-intro">
            <div className="done-emoji" aria-hidden>💬</div>
            <h1 className="page-title">{dialogue.title}</h1>
            <p>{dialogue.setting}</p>
            <p className="muted">
              Gesprächspartner: <strong>{dialogue.partner}</strong> · {userTotal} Antworten von dir
            </p>
            <p className="muted small">Antworte frei – per Tippen{recognition ? ' oder Mikrofon' : ''}. Es gibt oft mehrere richtige Antworten.</p>
          </div>
        </div>
      ) : (
        <div className="session-body chat" aria-live="polite">
          <label className="shadow-toggle">
            <input type="checkbox" checked={!showText} onChange={(e) => setShowText(!e.target.checked)} /> Kroatischen Text ausblenden (nur hören)
          </label>
          {log.map((e, i) =>
            e.kind === 'partner' ? (
              <div key={i} className="bubble partner">
                <div className="bubble-name">{dialogue.partner}</div>
                <div className="bubble-text" lang="hr">
                  {showText ? e.turn.hr : '🔊 · · ·'}
                  <SpeakButtons text={e.turn.hr} size="sm" />
                </div>
                {showDe.has(i) ? (
                  <div className="bubble-de">{e.turn.de}</div>
                ) : (
                  <button type="button" className="link-btn" onClick={() => setShowDe((s) => new Set(s).add(i))}>
                    Übersetzung
                  </button>
                )}
              </div>
            ) : (
              <div key={i} className="bubble user">
                <div className="bubble-text" lang="hr">
                  {e.spoken ? '🎤 ' : ''}
                  {e.answer}
                </div>
                <div className={`bubble-verdict ${VERDICT[e.check.verdict].tone}`}>{VERDICT[e.check.verdict].title}</div>
              </div>
            ),
          )}
          {userTurn && !finished && (
            <div className="task-card">
              <div className="task-label">Deine Aufgabe</div>
              <div className="task-text">{userTurn.task}</div>
              {helped && !current && (
                <div className="task-help" lang="hr">
                  💡 {userTurn.answers[0]!.replace(/\*/g, '…')}
                </div>
              )}
            </div>
          )}
          {current && userTurn && (
            <div className={`feedback ${VERDICT[current.check.verdict].tone}`} role="status">
              <div className="feedback-title">{VERDICT[current.check.verdict].title}</div>
              {current.spoken && <div className="feedback-body heard">🎤 Erkannt: „{current.answer}“</div>}
              {current.check.verdict !== 'perfect' && (
                <div className="feedback-body">
                  {current.check.verdict === 'good' ? 'Typisch wäre: ' : 'Vorschlag: '}
                  <strong lang="hr">{current.check.model.replace(/\*/g, '…')}</strong>
                  <SpeakButtons text={current.check.model.replace(/\*/g, '')} size="sm" />
                </div>
              )}
            </div>
          )}
          {finished && (
            <div className="done">
              <div className="done-emoji" aria-hidden>{total >= 80 ? '🎉' : '👍'}</div>
              <h2 className="page-title">{total >= 80 ? 'Bravo! Gespräch gemeistert.' : 'Gespräch geschafft!'}</h2>
              <p className="muted">{total} % – {total >= 80 ? 'du kannst diese Situation auf Kroatisch meistern.' : 'Wiederhole es gern, um noch sicherer zu werden.'}</p>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="session-footer">
        {!started ? (
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setStarted(true);
              advance(0);
            }}
          >
            Gespräch starten
          </button>
        ) : finished ? (
          <div className="footer-row">
            <button className="btn" onClick={restart}>
              Nochmal
            </button>
            <button className="btn btn-primary" onClick={close}>
              Fertig
            </button>
          </div>
        ) : current ? (
          <div className="footer-row">
            {current.check.verdict !== 'perfect' && (
              <button className="btn" onClick={retry}>
                Nochmal
              </button>
            )}
            <button className="btn btn-primary" onClick={accept}>
              Weiter
            </button>
          </div>
        ) : (
          userTurn && (
            <>
              {speechError && <SpeechHint problem={{ kind: 'recognition-error', code: speechError }} onClose={() => setSpeechError(undefined)} />}
              <form
                className="answer-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={inputRef}
                  className="answer-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Deine Antwort auf Kroatisch …"
                  lang="hr"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  enterKeyHint="send"
                />
                {recognition && (
                  <MicButton
                    lang="hr-HR"
                    onResult={(alts) => {
                      const r = checkDialogueAlternatives(alts, userTurn);
                      setInput(r.heard);
                      evaluate(r, r.heard, true);
                    }}
                    onError={setSpeechError}
                  />
                )}
              </form>
              <DiacriticsBar inputRef={inputRef} onInsert={setInput} />
              <div className="footer-row">
                <button type="button" className="btn" onClick={() => setHelped(true)} disabled={helped}>
                  Hilfe
                </button>
                <button type="button" className="btn btn-primary" disabled={!input.trim()} onClick={submit}>
                  Antworten
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
