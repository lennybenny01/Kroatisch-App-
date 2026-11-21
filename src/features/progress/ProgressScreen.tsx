import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { content } from '../../content';
import { db } from '../../db/db';
import { useLookup } from '../../hooks/useLookup';
import {
  accuracyByWeek,
  activityByDay,
  calendarGrid,
  dueForecast,
  levelProgress,
  statusCounts,
  streaks,
  weakSpots,
} from '../../domain/stats';
import { BackupCard } from './BackupCard';
import { AccuracyChart } from './charts/AccuracyChart';
import { CalendarHeatmap } from './charts/CalendarHeatmap';
import { DueChart } from './charts/DueChart';
import { StatusBar } from './charts/StatusBar';
import { LevelCard } from './LevelCard';
import { WeakSpotsCard } from './WeakSpotsCard';

const HEAT_WEEKS = 17;
const ACCURACY_WEEKS = 12;

export function ProgressScreen() {
  const lookup = useLookup();
  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), logs: await db.reviewLogs.toArray() }));
  const stats = useMemo(() => {
    if (!data) return undefined;
    const { cards, logs } = data;
    const kind = new Map(cards.map((c) => [c.id, c.kind]));
    const activity = activityByDay(logs);
    return {
      level: levelProgress(cards, content),
      status: statusCounts(cards),
      activity,
      streak: streaks(activity),
      grid: calendarGrid(activity, HEAT_WEEKS),
      accuracy: accuracyByWeek(logs, (id) => kind.get(id), ACCURACY_WEEKS),
      due: dueForecast(cards, 7),
      weak: weakSpots(logs, cards, lookup, Date.now(), 3),
      hasLogs: logs.length > 0,
    };
  }, [data, lookup]);
  if (!stats) return null;
  const totalDays = [...stats.activity.values()].filter((n) => n > 0).length;
  const due7 = stats.due.reduce((a, d) => a + d.count, 0);

  return (
    <>
      <h1 className="page-title">Fortschritt</h1>

      <LevelCard p={stats.level} />

      <section className="card" aria-label="Gelernte Wörter und Sätze">
        <h2 className="card-title">Wörter & Sätze</h2>
        <StatusBar title="Wörter" counts={stats.status.words} />
        <StatusBar title="Sätze" counts={stats.status.sentences} />
        <p className="muted card-note">„Gefestigt“: Du behältst die Karte voraussichtlich mindestens drei Wochen.</p>
      </section>

      <section className="card" aria-label="Lerntage">
        <h2 className="card-title">Lerntage</h2>
        <div className="stat-row compact">
          <div className="stat">
            <div className="stat-value">{stats.streak.current}</div>
            <div className="stat-label">{stats.streak.current === 1 ? 'Tag' : 'Tage'} Serie{stats.streak.current > 0 ? ' 🔥' : ''}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.streak.longest}</div>
            <div className="stat-label">Rekord</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalDays}</div>
            <div className="stat-label">Lerntage</div>
          </div>
        </div>
        {!stats.streak.today && stats.streak.current > 0 && <p className="streak-hint">Lerne heute, damit deine Serie weiterläuft.</p>}
        <CalendarHeatmap grid={stats.grid} />
      </section>

      <section className="card" aria-label="Trefferquote">
        <h2 className="card-title">Trefferquote</h2>
        {stats.hasLogs ? (
          <>
            <p className="muted card-sub">Anteil gewusster Antworten pro Woche (ohne Multiple Choice).</p>
            <AccuracyChart points={stats.accuracy} />
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Noch keine Antworten – nach den ersten Lerntagen siehst du hier deinen Verlauf.</p>
        )}
      </section>

      <section className="card" aria-label="Fällige Wiederholungen">
        <h2 className="card-title">Nächste 7 Tage</h2>
        <p className="muted card-sub">
          {due7} fällige Wiederholungen{stats.due[0]!.count ? `, davon ${stats.due[0]!.count} heute` : ''}.
        </p>
        <DueChart days={stats.due} />
      </section>

      <WeakSpotsCard weak={stats.weak} />

      <BackupCard />
    </>
  );
}
