import { useNavigate } from 'react-router-dom';
import { pronunciation } from '../../content/pronunciation';
import { isPronunciationComplete } from '../../domain/pronunciation';
import { usePronunciationProgress } from '../pronunciation/PronunciationLesson';
import { useState } from 'react';
import { SpeechHint } from '../../components/SpeechHint';
import { useSpeechSupport } from '../../hooks/useSpeechSupport';
import { LearningPath } from './LearningPath';
import { useLiveQuery } from 'dexie-react-hooks';
import { dialogues } from '../../content/dialogues';
import { db } from '../../db/db';
import { getDialogueResults } from '../../db/repo';
import { isDialogueAvailable } from '../../domain/units';
import { useTodayOverview } from './useTodayOverview';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 10) return 'Dobro jutro!';
  if (h < 18) return 'Dobar dan!';
  return 'Dobra večer!';
}

export function LearnHome() {
  const navigate = useNavigate();
  const o = useTodayOverview();
  const pron = usePronunciationProgress();
  const speech = useSpeechSupport();
  const dialogueResults = useLiveQuery(() => getDialogueResults(db), [], undefined);
  const [hideVoiceHint, setHideVoiceHint] = useState(() => {
    try {
      return localStorage.getItem('hideVoiceHint') === '1';
    } catch {
      return false;
    }
  });
  if (!o) return null;
  const total = o.due + o.newAvailable;
  const pronDone = isPronunciationComplete(pron, pronunciation.sounds, pronunciation.pairs);
  const nothingLearned = o.cards.every((c) => c.state === 0);
  // Before the first word: start with the pronunciation lesson (can be skipped).
  const pronFirst = !pronDone && nothingLearned;

  return (
    <>
      <div>
        <div className="muted">{greeting()}</div>
        <h1 className="page-title">Lernen</h1>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{o.due}</div>
          <div className="stat-label">fällig</div>
        </div>
        <div className="stat">
          <div className="stat-value">{o.newAvailable}</div>
          <div className="stat-label">neu</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {o.newToday}/{o.newLimit}
          </div>
          <div className="stat-label">Tagesziel</div>
        </div>
      </div>

      {pronFirst ? (
        <>
          <button className="btn btn-primary btn-block" style={{ minHeight: 64, fontSize: 19 }} onClick={() => navigate('/pronunciation')}>
            Mit der Aussprache beginnen
          </button>
          <button className="btn btn-ghost btn-block" disabled={total === 0} onClick={() => navigate('/session')}>
            Überspringen – direkt mit Wörtern starten
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-block" style={{ minHeight: 64, fontSize: 19 }} disabled={total === 0} onClick={() => navigate('/session')}>
          {total > 0 ? `Lernen starten · ${total} Karten` : 'Für heute alles geschafft ✓'}
        </button>
      )}
      {total === 0 && (
        <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
          Morgen geht’s weiter. Mehr neue Karten? Tagesziel in den Einstellungen erhöhen.
        </p>
      )}

      {(() => {
        if (!dialogueResults) return null;
        const next = dialogues.find((d) => !dialogueResults[d.id] && o.unlocked.has(d.unitId) && isDialogueAvailable(d.unitId, o.cards));
        return next ? (
          <button className="card dialogue-card" onClick={() => navigate(`/dialogue/${next.unitId}`)}>
            <span className="dialogue-card-icon" aria-hidden>💬</span>
            <span>
              <span className="muted small">Neuer Dialog verfügbar</span>
              <strong>{next.title}</strong>
            </span>
          </button>
        ) : null;
      })()}

      <button className="btn btn-block shadow-entry" onClick={() => navigate('/shadowing')}>
        🎧 Shadowing – Sätze hören und nachsprechen
      </button>

      {!hideVoiceHint && (speech.tts === 'missing' || speech.tts === 'unsupported') && (
        <SpeechHint
          problem={{ kind: speech.tts === 'missing' ? 'tts-no-voice' : 'tts-unsupported' }}
          onClose={() => {
            setHideVoiceHint(true);
            try {
              localStorage.setItem('hideVoiceHint', '1');
            } catch {
              /* private mode */
            }
          }}
        />
      )}

      <h2 className="section-title">Lernpfad</h2>
      <LearningPath cards={o.cards} unlocked={o.unlocked} pronunciation={{ done: pronDone, practised: pron.practised.length + pron.pairs.length, total: pronunciation.sounds.length + pronunciation.pairs.length }} />
    </>
  );
}
