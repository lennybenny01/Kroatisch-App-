import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { content } from '../../content';
import { IconClose } from '../../app/icons';
import { db } from '../../db/db';
import { countNewIntroduced, defaultScheduler, getSettings, recordReview, refreshUnlockedUnits } from '../../db/repo';
import { buildExercise, exerciseMode } from '../../domain/exercise';
import { advanceQueue, buildSession } from '../../domain/session';
import { Rating, type CardRecord, type Settings } from '../../domain/types';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import { dayKey } from '../../lib/date';
import { ExerciseView, type AnswerMeta } from './ExerciseView';

interface SessionState {
  cards: Map<string, CardRecord>;
  queue: string[];
  total: number;
  settings: Settings;
}

export function SessionScreen() {
  useVisualViewport();
  const navigate = useNavigate();
  const [s, setS] = useState<SessionState>();
  const [turn, setTurn] = useState(0);
  const [stats, setStats] = useState({ answered: 0, good: 0, newSeen: new Set<string>() });
  const [now, setNow] = useState(Date.now());
  const [newUnits, setNewUnits] = useState<string[]>([]);
  const busy = useRef(false);
  const finished = !!s && s.queue.length === 0;

  // When the session is over, check whether a new unit was unlocked.
  useEffect(() => {
    if (!finished) return;
    void refreshUnlockedUnits(db).then((r) => setNewUnits(r.newlyUnlocked));
  }, [finished]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { unlocked } = await refreshUnlockedUnits(db);
      const [cards, settings, introduced] = await Promise.all([
        db.cards.toArray(),
        getSettings(db),
        countNewIntroduced(db, dayKey(Date.now())),
      ]);
      const plan = buildSession({
        cards,
        now: Date.now(),
        newLimit: settings.newCardsPerDay,
        newIntroducedToday: introduced,
        unlockedUnits: unlocked,
      });
      if (!alive) return;
      setS({ cards: new Map(cards.map((c) => [c.id, c])), queue: plan.queue, total: plan.queue.length, settings });
      setNow(Date.now());
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currentId = s?.queue[0];
  const current = currentId ? s.cards.get(currentId) : undefined;
  // Rebuild only when the shown card changes (keeps multiple-choice order stable).
  const exercise = useMemo(
    () => (current ? buildExercise(current, current, content) : undefined),
    [currentId, turn],
  );
  const preview = useMemo(() => (current ? defaultScheduler.preview(current, now) : undefined), [current, now]);

  if (!s) return <div className="session" />;

  const close = () => navigate('/learn');
  const done = s.total - s.queue.length;

  const nextNeedsTyping = (r: Rating) => {
    if (!current || !preview) return false;
    const nextQueue = advanceQueue(s.queue, current.id, preview[r].due, Date.now());
    const next = nextQueue[0] && (nextQueue[0] === current.id ? preview[r] : s.cards.get(nextQueue[0]));
    return !!next && exerciseMode(next) === 'type';
  };

  const onRate = async (rating: Rating, meta: AnswerMeta) => {
    if (!current || busy.current) return;
    busy.current = true;
    try {
      const ts = Date.now();
      const updated = await recordReview(db, current.id, rating, meta, ts);
      setStats((st) => ({
        answered: st.answered + 1,
        good: st.good + (rating >= Rating.Hard ? 1 : 0),
        newSeen: meta.wasMultipleChoice ? new Set(st.newSeen).add(current.id) : st.newSeen,
      }));
      setS((prev) => {
        if (!prev) return prev;
        const cards = new Map(prev.cards).set(updated.id, updated);
        return { ...prev, cards, queue: advanceQueue(prev.queue, updated.id, updated.due, ts) };
      });
      setNow(Date.now());
      setTurn((t) => t + 1);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="session">
      <header className="session-header">
        <button className="icon-btn" onClick={close} aria-label="Session beenden">
          <IconClose />
        </button>
        <div className="progress-bar" aria-hidden>
          <div style={{ width: `${s.total ? (done / s.total) * 100 : 100}%` }} />
        </div>
        <span className="session-count">{s.queue.length > 0 ? `${s.queue.length} übrig` : ''}</span>
      </header>

      {exercise && preview ? (
        <ExerciseView
          exercise={exercise}
          turn={turn}
          preview={preview}
          now={now}
          strictDiacritics={s.settings.strictDiacritics}
          nextNeedsTyping={nextNeedsTyping}
          onRate={(r, m) => void onRate(r, m)}
        />
      ) : (
        <div className="session-body">
          <div className="done">
            <div className="done-emoji" aria-hidden>🎉</div>
            <h1 className="page-title">{stats.answered ? 'Bravo! Gotovo za danas.' : 'Nichts zu tun'}</h1>
            {newUnits.map((id) => (
              <div key={id} className="feedback ok" role="status">
                <div className="feedback-title">🔓 Neue Einheit freigeschaltet</div>
                <div className="feedback-body">{content.unitById.get(id)?.title}</div>
              </div>
            ))}
            {stats.answered > 0 ? (
              <p className="muted">
                {stats.answered} Antworten · {Math.round((stats.good / stats.answered) * 100)} % gewusst · {stats.newSeen.size} neue Karten
              </p>
            ) : (
              <p className="muted">Gerade ist nichts fällig. Schau später wieder vorbei!</p>
            )}
            <button className="btn btn-primary btn-block" onClick={close}>
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
