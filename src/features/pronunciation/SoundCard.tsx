import { useState } from 'react';
import { IconSpeaker } from '../../app/icons';
import type { PronSound } from '../../content/pronunciation';
import { soundQuiz, type PronQuestion } from '../../domain/pronunciation';
import { RATE_SLOW, speak } from '../../lib/tts';
import { PronQuiz } from './PronQuiz';

export function WordChip({ hr, de }: { hr: string; de: string }) {
  return (
    <button type="button" className="word-chip" onClick={() => speak(hr, 'hr', RATE_SLOW)} aria-label={`${hr} anhören`}>
      <IconSpeaker width={16} height={16} />
      <span lang="hr">{hr}</span>
      <span className="muted">{de}</span>
    </button>
  );
}

export function SoundCard({ sound, practised, onPractised }: { sound: PronSound; practised: boolean; onPractised: () => void }) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<PronQuestion[]>();
  const [quizKey, setQuizKey] = useState(0);
  const [result, setResult] = useState<number>();

  const startQuiz = () => {
    const qs = soundQuiz(sound);
    speak(qs[0]!.word, 'hr', RATE_SLOW); // inside the tap
    setQuestions(qs);
    setResult(undefined);
    setQuizKey((k) => k + 1);
  };

  return (
    <section className={`sound-card${open ? ' open' : ''}`} id={`laut-${sound.id}`}>
      <button type="button" className="sound-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sound-letter" lang="hr">
          {sound.letter}
        </span>
        <span className="sound-summary">
          <strong>{sound.summary}</strong>
          <span className="muted">
            {sound.examples.map((e) => e.hr).join(' · ')}
          </span>
        </span>
        {practised && (
          <span className="badge ok-badge" aria-label="geübt">
            ✓
          </span>
        )}
      </button>
      {open && (
        <div className="sound-body">
          <p>{sound.explanation}</p>
          <p className="compare">
            🇩🇪 Wie {sound.compare.hint}
          </p>
          <div className="word-chips">
            {sound.examples.map((e) => (
              <WordChip key={e.hr} {...e} />
            ))}
          </div>
          {!questions || result !== undefined ? (
            <>
              {result !== undefined && (
                <div className={`feedback ${result === questions?.length ? 'ok' : 'almost'}`} role="status">
                  <div className="feedback-title">
                    {result} von {questions?.length} richtig{result === questions?.length ? ' – super!' : ''}
                  </div>
                </div>
              )}
              <button type="button" className="btn btn-primary btn-block" onClick={startQuiz}>
                {result === undefined ? `„${sound.letter}“ üben` : 'Nochmal üben'}
              </button>
            </>
          ) : (
            <PronQuiz
              key={quizKey}
              questions={questions}
              onDone={(n) => {
                setResult(n);
                onPractised();
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
