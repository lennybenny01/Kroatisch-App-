import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CardState, Rating } from '../../domain/types';
import { dayKey } from '../../lib/date';

/** Consecutive learning days up to today (today counts if already learned, otherwise from yesterday). */
function streak(days: Set<string>, now = Date.now()): number {
  let n = 0;
  let t = now;
  if (!days.has(dayKey(t))) t -= 86_400_000;
  while (days.has(dayKey(t))) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

export function ProgressScreen() {
  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), logs: await db.reviewLogs.toArray() }));
  if (!data) return null;
  const { cards, logs } = data;
  const today = dayKey(Date.now());
  const todayLogs = logs.filter((l) => l.day === today);
  const correctToday = todayLogs.filter((l) => l.rating >= Rating.Hard).length;
  const by = (pred: (c: (typeof cards)[number]) => boolean) => cards.filter(pred).length;

  const rows = [
    { label: 'Noch nicht gesehen', value: by((c) => c.state === CardState.New) },
    { label: 'In der Lernphase', value: by((c) => c.state === CardState.Learning || c.state === CardState.Relearning) },
    { label: 'In Wiederholung', value: by((c) => c.state === CardState.Review && c.stability < 21) },
    { label: 'Sitzt fest (≥ 3 Wochen)', value: by((c) => c.state === CardState.Review && c.stability >= 21) },
  ];

  return (
    <>
      <h1 className="page-title">Fortschritt</h1>
      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{streak(new Set(logs.map((l) => l.day)))}</div>
          <div className="stat-label">Tage in Folge</div>
        </div>
        <div className="stat">
          <div className="stat-value">{todayLogs.length}</div>
          <div className="stat-label">Antworten heute</div>
        </div>
        <div className="stat">
          <div className="stat-value">{todayLogs.length ? `${Math.round((correctToday / todayLogs.length) * 100)}%` : '–'}</div>
          <div className="stat-label">gewusst</div>
        </div>
      </div>
      <h2 className="section-title">Karten ({cards.length})</h2>
      <div className="list">
        {rows.map((r) => (
          <div key={r.label} className="list-item">
            <span className="grow">{r.label}</span>
            <span className="badge">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Ausführliche Statistiken folgen in einem späteren Schritt.
      </p>
    </>
  );
}
