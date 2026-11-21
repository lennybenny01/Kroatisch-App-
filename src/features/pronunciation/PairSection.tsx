import { useState } from 'react';
import type { PronPair } from '../../content/pronunciation';
import { pairQuiz, type PronQuestion } from '../../domain/pronunciation';
import { RATE_SLOW, speak, speakSequence } from '../../lib/tts';
import { PronQuiz } from './PronQuiz';
import { WordChip } from './SoundCard';

/** The hard pairs side by side: hard vs. soft, with listening comparison and exercise. */
export function PairSection({ pair, practised, onPractised }: { pair: PronPair; practised: boolean; onPractised: () => void }) {
  const [questions, setQuestions] = useState<PronQuestion[]>();
  const [quizKey, setQuizKey] = useState(0);
  const [result, setResult] = useState<number>();

  const start = () => {
    const qs = pairQuiz(pair);
    speak(qs[0]!.word, 'hr', RATE_SLOW); // inside the tap
    setQuestions(qs);
    setResult(undefined);
    setQuizKey((k) => k + 1);
  };

  const alternate = pair.left.words.flatMap((w, i) => [w.hr, pair.right.words[i]?.hr ?? '']).filter(Boolean);

  return (
    <section className="pair-card">
      <div className="pair-title">
        <h3>{pair.title}</h3>
        {practised && <span className="badge ok-badge">✓ geübt</span>}
      </div>
      <p>{pair.explanation}</p>
      <div className="pair-grid">
        {[pair.left, pair.right].map((side) => (
          <div key={side.letter} className={`pair-side ${side.label === 'hart' ? 'hard' : 'soft'}`}>
            <div className="pair-letter" lang="hr">
              {side.letter}
            </div>
            <div className="pair-label">{side.label}</div>
            <p className="pair-how">{side.how}</p>
            <div className="word-chips column">
              {side.words.map((w) => (
                <WordChip key={w.hr} {...w} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-block" onClick={() => speakSequence(alternate)}>
        🔁 Abwechselnd anhören
      </button>
      <p className="muted pair-tip">💡 {pair.tip}</p>
      {!questions || result !== undefined ? (
        <>
          {result !== undefined && (
            <div className={`feedback ${result === questions?.length ? 'ok' : 'almost'}`} role="status">
              <div className="feedback-title">
                {result} von {questions?.length} richtig
              </div>
            </div>
          )}
          <button type="button" className="btn btn-primary btn-block" onClick={start}>
            {pair.left.letter} oder {pair.right.letter}? – {result === undefined ? 'üben' : 'nochmal üben'}
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
    </section>
  );
}
