import { useState } from 'react';
import { IconSpeaker } from '../../app/icons';
import type { PronQuestion } from '../../domain/pronunciation';
import { RATE_NORMAL, RATE_SLOW, speak } from '../../lib/tts';

/** Shows the word with a visible gap, or – after answering – with the sound highlighted. */
export function GapWord({ q, revealed }: { q: PronQuestion; revealed: boolean }) {
  const [before, after] = q.blank.split('_') as [string, string];
  return (
    <span className="gap-word" lang="hr">
      {before}
      {revealed ? <mark className="dia">{q.answer}</mark> : <span className="gap" aria-label="Lücke">?</span>}
      {after}
    </span>
  );
}

/**
 * Listening exercise: hear the word, tap the right letter.
 * The first word must be spoken by the caller inside the tap that opens the quiz
 * (browsers only allow speech after a user gesture).
 */
export function PronQuiz({ questions, onDone }: { questions: PronQuestion[]; onDone: (correct: number) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string>();
  const [correct, setCorrect] = useState(0);
  const q = questions[i]!;
  const last = i === questions.length - 1;

  const pick = (o: string) => {
    if (picked) return;
    setPicked(o);
    if (o === q.answer) setCorrect((c) => c + 1);
    speak(q.word, 'hr', RATE_SLOW);
  };
  const next = () => {
    if (last) {
      onDone(correct);
      return;
    }
    const n = questions[i + 1]!;
    speak(n.word, 'hr', RATE_SLOW); // inside the tap → allowed
    setI(i + 1);
    setPicked(undefined);
  };

  return (
    <div className="pron-quiz">
      <div className="pron-quiz-head">
        <span className="muted">
          Wort {i + 1} von {questions.length}
        </span>
        <span className="muted">Hör zu und tippe den richtigen Buchstaben an</span>
      </div>
      <div className="pron-listen">
        <button type="button" className="btn listen-btn" onClick={() => speak(q.word, 'hr', RATE_NORMAL)}>
          <IconSpeaker width={22} height={22} /> Anhören
        </button>
        <button type="button" className="btn listen-btn" onClick={() => speak(q.word, 'hr', RATE_SLOW)}>
          🐢 Langsam
        </button>
      </div>
      <div className="pron-word">
        <GapWord q={q} revealed={!!picked} />
        {picked && <div className="muted pron-de">{q.de}</div>}
      </div>
      <div className="pron-options" role="group" aria-label="Welcher Buchstabe fehlt?">
        {q.options.map((o) => {
          const state = !picked ? '' : o === q.answer ? ' correct' : o === picked ? ' wrong' : '';
          return (
            <button key={o} type="button" className={`pron-option${state}`} onClick={() => pick(o)} disabled={!!picked} lang="hr">
              {o}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className={`feedback ${picked === q.answer ? 'ok' : 'bad'}`} role="status">
          <div className="feedback-title">{picked === q.answer ? 'Točno!' : `Nicht ganz – hier fehlt „${q.answer}“.`}</div>
        </div>
      )}
      {picked && (
        <button type="button" className="btn btn-primary btn-block" onClick={next}>
          {last ? 'Fertig' : 'Weiter'}
        </button>
      )}
    </div>
  );
}
