import { useNavigate } from 'react-router-dom';
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
  if (!o) return null;
  const total = o.due + o.newAvailable;

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

      <button className="btn btn-primary btn-block" style={{ minHeight: 64, fontSize: 19 }} disabled={total === 0} onClick={() => navigate('/session')}>
        {total > 0 ? `Lernen starten · ${total} Karten` : 'Für heute alles geschafft ✓'}
      </button>
      {total === 0 && (
        <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
          Morgen geht’s weiter. Mehr neue Karten? Tagesziel in den Einstellungen erhöhen.
        </p>
      )}

      <h2 className="section-title">Lernpfad A1</h2>
      <LearningPath cards={o.cards} unlocked={o.unlocked} />
    </>
  );
}
