import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { content } from '../../content';
import { GrammarDetails } from '../../components/GrammarDetails';
import { IconSpeaker } from '../../app/icons';
import { checkAnswer, suggestRating } from '../../domain/answerCheck';
import type { Exercise } from '../../domain/exercise';
import type { Preview } from '../../domain/scheduler';
import type { AnswerVerdict, Rating } from '../../domain/types';
import { speak, ttsSupported } from '../../lib/tts';
import { DiacriticsBar } from './DiacriticsBar';
import { RatingBar } from './RatingBar';

export interface AnswerMeta {
  answer: string;
  verdict: AnswerVerdict;
  wasMultipleChoice: boolean;
  durationMs: number;
}

interface Props {
  exercise: Exercise;
  /** Changes with every shown card, even if the same card repeats. */
  turn: number;
  preview: Preview;
  now: number;
  strictDiacritics: boolean;
  /** Whether the card after this one asks for typing – used to open the keyboard in time. */
  nextNeedsTyping: (r: Rating) => boolean;
  onRate: (r: Rating, meta: AnswerMeta) => void;
}

const KIND_LABEL: Record<Exercise['kind'], string> = {
  recognize: 'Verstehen · HR → DE',
  produce: 'Sprechen · DE → HR',
  cloze: 'Lückentext',
};

const GENDER_LABEL: Record<string, string> = { m: 'maskulin', f: 'feminin', n: 'neutrum' };
const POS_LABEL: Record<string, string> = {
  noun: 'Nomen',
  verb: 'Verb',
  adj: 'Adjektiv',
  adv: 'Adverb',
  pron: 'Pronomen',
  prep: 'Präposition',
  conj: 'Konjunktion',
  num: 'Zahlwort',
  particle: 'Partikel',
  phrase: 'Redewendung',
};
const ASPECT_LABEL = { impf: 'unvollendet', pf: 'vollendet', both: 'beide Aspekte' } as const;

/** Grammatical info line, e.g. "Nomen · feminin" or "Verb · unvollendet · vollendet: popiti". */
function wordInfo(w: Exercise['word']): string {
  const parts = [POS_LABEL[w.pos] ?? ''];
  if (w.gender) parts.push(GENDER_LABEL[w.gender]! + (w.pluralOnly ? ', nur Plural' : ''));
  if (w.aspect) {
    parts.push(ASPECT_LABEL[w.aspect]);
    parts.push(w.aspectPartner ? `${w.aspect === 'pf' ? 'unvollendet' : 'vollendet'}: ${w.aspectPartner}` : 'kein Aspektpartner');
  }
  return parts.filter(Boolean).join(' · ');
}

function markDiacritics(s: string): ReactNode[] {
  return [...s].map((ch, i) => (/[čćšžđ]/i.test(ch) ? <mark key={i} className="dia">{ch}</mark> : ch));
}

export function ExerciseView({ exercise: ex, turn, preview, now, strictDiacritics, nextNeedsTyping, onRate }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ verdict: AnswerVerdict; solution: string; answer: string }>();
  const [chosen, setChosen] = useState<string>();
  const startedAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastTurn, setLastTurn] = useState(turn);

  // Reset local state for each new card (the input element itself stays mounted,
  // so iOS keeps letting us focus it from the rating button's tap).
  if (lastTurn !== turn) {
    setLastTurn(turn);
    setInput('');
    setResult(undefined);
    setChosen(undefined);
  }
  useEffect(() => {
    startedAt.current = performance.now();
    if (ex.mode === 'type') inputRef.current?.focus();
  }, [turn, ex.mode]);

  const typing = ex.mode === 'type' && !result;
  const check = (answer: string) => {
    const r = checkAnswer({ input: answer, expected: ex.expected, lang: ex.answerLang, lemma: ex.lemma });
    setResult({ ...r, answer });
    inputRef.current?.blur(); // close keyboard → room for feedback + rating
    if (ex.answerLang === 'hr' || r.verdict !== 'wrong') speak(r.solution, ex.answerLang);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) check(input);
  };

  const rate = (r: Rating) => {
    if (!result) return;
    // Focus synchronously inside the tap handler – iOS only opens the keyboard then.
    if (nextNeedsTyping(r)) inputRef.current?.focus();
    onRate(r, {
      answer: result.answer,
      verdict: result.verdict,
      wasMultipleChoice: ex.mode === 'choice',
      durationMs: performance.now() - startedAt.current,
    });
  };

  const suggested = result ? suggestRating(result.verdict, strictDiacritics) : undefined;
  const isNew = ex.mode === 'choice';
  const solutionLang = ex.answerLang;

  return (
    <>
      <div className="session-body">
        <div className="prompt">
          <div className="prompt-label">
            {isNew && <span className="kind-badge new">Neu</span>}
            <span className="kind-badge">{KIND_LABEL[ex.kind]}</span>
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: -4 }}>{content.unitById.get(ex.word.unitId)?.title}</div>
          <div className="muted">{ex.label}</div>
          <div className={`prompt-text${ex.kind === 'cloze' ? ' sentence' : ''}`} lang={ex.promptLang}>
            {ex.prompt}
          </div>
          {ex.hint && <div className="prompt-hint">{ex.hint}</div>}
          {ttsSupported && ex.promptLang === 'hr' && ex.kind === 'recognize' && (
            <button type="button" className="icon-btn" aria-label="Vorlesen" onClick={() => speak(ex.prompt)}>
              <IconSpeaker />
            </button>
          )}
        </div>

        {ex.mode === 'choice' && (
          <div className="choices">
            {ex.choices!.map((c) => {
              const isCorrect = result && checkAnswer({ input: c, expected: ex.expected, lang: ex.answerLang }).verdict === 'correct';
              const cls = result ? (isCorrect ? ' correct' : c === chosen ? ' wrong' : '') : '';
              return (
                <button
                  key={c}
                  type="button"
                  className={`choice${cls}`}
                  disabled={!!result}
                  lang={ex.answerLang}
                  onClick={() => {
                    setChosen(c);
                    check(c);
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {result && <Feedback ex={ex} result={result} strictDiacritics={strictDiacritics} lang={solutionLang} />}
      </div>

      <div className="session-footer">
        {/* Always mounted (see above); visually hidden when not needed. */}
        <form onSubmit={submit} style={typing ? undefined : hiddenStyle} aria-hidden={!typing}>
          <input
            ref={inputRef}
            className="answer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ex.answerLang === 'hr' ? 'Auf Kroatisch …' : 'Auf Deutsch …'}
            lang={ex.answerLang}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            tabIndex={typing ? 0 : -1}
          />
        </form>
        {typing && ex.answerLang === 'hr' && <DiacriticsBar inputRef={inputRef} onInsert={setInput} />}
        {typing && (
          <div className="footer-row">
            <button type="button" className="btn" onClick={() => check('')}>
              Weiß nicht
            </button>
            <button type="button" className="btn btn-primary" disabled={!input.trim()} onClick={() => check(input)}>
              Prüfen
            </button>
          </div>
        )}
        {result && suggested !== undefined && <RatingBar preview={preview} now={now} suggested={suggested} onRate={rate} />}
      </div>
    </>
  );
}

const hiddenStyle = { position: 'absolute', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' } as const;

function Feedback({
  ex,
  result,
  strictDiacritics,
  lang,
}: {
  ex: Exercise;
  result: { verdict: AnswerVerdict; solution: string; answer: string };
  strictDiacritics: boolean;
  lang: 'hr' | 'de';
}) {
  const { verdict, solution, answer } = result;
  const tone = verdict === 'correct' ? 'ok' : verdict === 'wrong' || (verdict === 'diacritics' && strictDiacritics) ? 'bad' : 'almost';
  const title: Record<AnswerVerdict, string> = {
    correct: 'Točno! Richtig.',
    diacritics: strictDiacritics ? 'Achtung: Sonderzeichen fehlen' : 'Fast richtig – achte auf die Sonderzeichen',
    typo: 'Fast richtig – kleiner Tippfehler',
    form: 'Richtiges Wort, aber falsche Form',
    wrong: answer ? 'Leider falsch' : 'Die Lösung',
  };
  const w = ex.word;
  // The cloze sentence itself, otherwise the word's example or a practice sentence containing it.
  const example = ex.sentence ?? w.example ?? content.sentences.find((s) => s.clozeWordId === w.id);
  const grammar = ex.sentence?.grammarId ? content.grammarById.get(ex.sentence.grammarId) : undefined;
  return (
    <>
      <div className={`feedback ${tone}`} role="status" aria-live="polite">
        <div className="feedback-title">{title[verdict]}</div>
        {verdict !== 'correct' && (
          <div className="feedback-body">
            <div className="solution" lang={lang}>
              {lang === 'hr' ? markDiacritics(solution) : solution}
            </div>
            {answer && <div>Deine Antwort: <span className="your-answer">{answer}</span></div>}
          </div>
        )}
        {ex.sentence?.clozeNote && verdict !== 'correct' && <div className="feedback-body">💡 {ex.sentence.clozeNote}</div>}
      </div>
      <div className="card info-card">
        <div>
          <strong lang="hr">{w.hr}</strong> – {w.de.join(', ')}
          {ttsSupported && (
            <button type="button" className="icon-btn" style={{ width: 36, height: 36, display: 'inline-grid', verticalAlign: 'middle' }} aria-label="Vorlesen" onClick={() => speak(w.hr)}>
              <IconSpeaker width={20} height={20} />
            </button>
          )}
        </div>
        <div className="muted">{wordInfo(w)}</div>
        {w.notes && <div>💡 {w.notes}</div>}
        {example && (
          <div className="example">
            <span lang="hr">{example.hr}</span>
            {ttsSupported && (
              <button type="button" className="icon-btn inline" aria-label="Satz vorlesen" onClick={() => speak(example.hr)}>
                <IconSpeaker width={18} height={18} />
              </button>
            )}
            <div className="muted">{example.de}</div>
          </div>
        )}
      </div>
      {grammar && <GrammarDetails topic={grammar} />}
    </>
  );
}
