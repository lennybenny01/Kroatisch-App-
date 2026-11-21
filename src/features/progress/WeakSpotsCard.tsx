import { useNavigate } from 'react-router-dom';
import type { WeakItem, WeakSpots } from '../../domain/stats';
import { WEAK_WINDOW_DAYS } from '../../domain/stats';

function Group({ title, items, type }: { title: string; items: WeakItem[]; type: 'word' | 'grammar' | 'unit' }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <div className="weak-group">
      <div className="weak-title">{title}</div>
      <ul className="list weak-list">
        {items.map((it) => (
          <li key={it.id} className="list-item">
            <div className="grow">
              <div className="weak-label" lang={type === 'word' ? 'hr' : undefined}>
                {it.label}
              </div>
              <div className="muted weak-sub">
                {it.errors} {it.errors === 1 ? 'Fehler' : 'Fehler'} bei {it.attempts} {it.attempts === 1 ? 'Antwort' : 'Antworten'}
                {it.sub ? ` · ${it.sub}` : ''}
              </div>
              <div className="weak-meter" aria-hidden>
                <div style={{ width: `${Math.round(it.errorRate * 100)}%` }} />
              </div>
            </div>
            <button className="btn btn-small" onClick={() => navigate(`/session?focus=${type}:${encodeURIComponent(it.id)}`)} aria-label={`${it.label} gezielt üben`}>
              Üben
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeakSpotsCard({ weak }: { weak: WeakSpots }) {
  const navigate = useNavigate();
  const empty = !weak.words.length && !weak.grammar.length && !weak.units.length;
  return (
    <section className="card" aria-label="Schwachstellen">
      <h2 className="card-title">Schwachstellen</h2>
      {empty ? (
        <p className="muted" style={{ margin: 0 }}>
          Keine Fehler in den letzten {WEAK_WINDOW_DAYS} Tagen – oder noch zu wenige Antworten. Weiter so!
        </p>
      ) : (
        <>
          <p className="muted card-sub">Am häufigsten mit „Nochmal“ bewertet (letzte {WEAK_WINDOW_DAYS} Tage).</p>
          <Group title="Wörter" items={weak.words} type="word" />
          <Group title="Fälle & Grammatik" items={weak.grammar} type="grammar" />
          <Group title="Themen" items={weak.units} type="unit" />
          <button className="btn btn-primary btn-block" onClick={() => navigate('/session?focus=weak')}>
            🎯 Jetzt gezielt üben
          </button>
        </>
      )}
    </section>
  );
}
