import { useNavigate } from 'react-router-dom';
import { pronunciation } from '../../content/pronunciation';
import { isPronunciationComplete } from '../../domain/pronunciation';
import { usePronunciationProgress } from '../pronunciation/PronunciationLesson';
import { LearningPath } from './LearningPath';
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

      <h2 className="section-title">Lernpfad</h2>
      <LearningPath cards={o.cards} unlocked={o.unlocked} pronunciation={{ done: pronDone, practised: pron.practised.length + pron.pairs.length, total: pronunciation.sounds.length + pronunciation.pairs.length }} />
    </>
  );
}
