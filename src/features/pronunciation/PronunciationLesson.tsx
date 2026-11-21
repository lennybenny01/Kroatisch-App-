import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { pronunciation } from '../../content/pronunciation';
import { db } from '../../db/db';
import { getPronunciationProgress, markPronunciationPractised } from '../../db/repo';
import { EMPTY_PRON_PROGRESS, isPronunciationComplete } from '../../domain/pronunciation';
import { useCroatianVoice } from '../../hooks/useCroatianVoice';
import { RATE_SLOW, speak } from '../../lib/tts';
import { PairSection } from './PairSection';
import { SoundCard } from './SoundCard';

export function usePronunciationProgress() {
  return useLiveQuery(() => getPronunciationProgress(db), [], EMPTY_PRON_PROGRESS);
}

/** The pronunciation lesson: rules, every special sound with exercise, the hard pairs. */
export function PronunciationLesson({ onFinish }: { onFinish?: () => void }) {
  const { intro, sounds, pairs } = pronunciation;
  const progress = usePronunciationProgress();
  const voice = useCroatianVoice();
  const total = sounds.length + pairs.length;
  const done = progress.practised.filter((id) => sounds.some((s) => s.id === id)).length + progress.pairs.length;
  const complete = isPronunciationComplete(progress, sounds, pairs);

  // Mark the lesson as completed once every exercise was done.
  useEffect(() => {
    if (complete && !progress.completedAt) void markPronunciationPractised(db, { complete: true });
  }, [complete, progress.completedAt]);

  return (
    <div className="pron-lesson">
      <div className="pron-progress">
        <div className="progress-bar">
          <div style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="muted">
          {done} / {total} Übungen
        </span>
      </div>

      {voice === 'missing' && (
        <div className="feedback almost" role="note">
          <div className="feedback-title">Keine kroatische Stimme gefunden</div>
          <div className="feedback-body">
            Für die Hörbeispiele brauchst du eine kroatische Stimme auf deinem Gerät.
            <br />
            <strong>iPhone:</strong> Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Kroatisch.
            <br />
            <strong>Android:</strong> Einstellungen → System → Sprachen → Sprachausgabe → Google → Sprachdaten installieren → Kroatisch.
          </div>
        </div>
      )}
      {voice === 'unsupported' && (
        <div className="feedback almost" role="note">
          <div className="feedback-title">Dieser Browser kann nicht vorlesen.</div>
        </div>
      )}

      <section className="card pron-intro">
        <h2>{intro.spelling.title}</h2>
        {intro.spelling.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section className="card pron-intro">
        <h2>{intro.stress.title}</h2>
        {intro.stress.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <div className="stress-list">
          {intro.stress.examples.map((e) => (
            <button key={e.hr} type="button" className="stress-word" onClick={() => speak(e.hr, 'hr', RATE_SLOW)}>
              <span lang="hr">
                {e.syllables.map((s, i) => (
                  <span key={i} className={i === e.stressed ? 'stressed' : undefined}>
                    {i > 0 && '·'}
                    {s}
                  </span>
                ))}
              </span>
              <span className="muted">{e.de}</span>
            </button>
          ))}
        </div>
      </section>

      <h2 className="section-title">Die Sonderlaute</h2>
      <p className="muted pron-hint">Tippe auf einen Laut für Erklärung, Hörbeispiele und Übung.</p>
      {sounds.map((s) => (
        <SoundCard
          key={s.id}
          sound={s}
          practised={progress.practised.includes(s.id)}
          onPractised={() => void markPronunciationPractised(db, { sound: s.id })}
        />
      ))}

      <h2 className="section-title">Schwierige Paare</h2>
      {pairs.map((p) => (
        <PairSection
          key={p.id}
          pair={p}
          practised={progress.pairs.includes(p.id)}
          onPractised={() => void markPronunciationPractised(db, { pair: p.id })}
        />
      ))}

      <section className="card pron-intro">
        <h2>Die übrigen Buchstaben</h2>
        <div className="others">
          {intro.others.map((o) => (
            <button key={o.letter} type="button" className="other-row" onClick={() => speak(o.hr, 'hr', RATE_SLOW)}>
              <span className="other-letter" lang="hr">
                {o.letter}
              </span>
              <span>
                {o.text}
                <span className="muted">
                  {' '}
                  – <span lang="hr">{o.hr}</span> ({o.de})
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {complete ? (
        <div className="feedback ok" role="status">
          <div className="feedback-title">🎉 Aussprache-Lektion abgeschlossen</div>
          <div className="feedback-body">Du kannst sie jederzeit über das Aussprache-Symbol oben rechts wieder öffnen.</div>
        </div>
      ) : (
        <p className="muted pron-hint">Übe alle Laute und beide Paare, um die Lektion abzuschließen.</p>
      )}
      {onFinish && (
        <button type="button" className="btn btn-primary btn-block" onClick={onFinish}>
          {complete ? 'Weiter zu den Wörtern' : 'Zurück'}
        </button>
      )}
    </div>
  );
}
