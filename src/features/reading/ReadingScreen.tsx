import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconBack } from '../../app/icons';
import { SpeakButtons } from '../../components/SpeakButtons';
import { content } from '../../content';
import { analyzeSentence, buildFormIndex, tokenize } from '../../content/analyze';
import names from '../../content/names.json';
import { db } from '../../db/db';
import { saveTextResult } from '../../db/repo';
import { foldDiacritics, normalize } from '../../domain/answerCheck';

interface Piece {
  text: string;
  /** Lemma + meaning when tapped. */
  info?: { hr: string; de: string };
}

const fold = (s: string) => foldDiacritics(normalize(s));

/** Splits a paragraph into tappable words (course vocabulary or glossary) and plain text. */
let formIndex: ReturnType<typeof buildFormIndex> | undefined;

function piecesFor(paragraph: string, glossary: { hr: string; de: string }[]): Piece[] {
  const index = (formIndex ??= buildFormIndex(content.words));
  const a = analyzeSentence(paragraph, index, new Set(names));
  const gloss = new Map(glossary.map((g) => [fold(g.hr), g]));
  const out: Piece[] = [];
  let pos = 0;
  const matches = [...a.matches];
  for (const t of tokenize(paragraph)) {
    if (t.start < pos) continue;
    const m = matches.find((x) => x.start === t.start);
    if (m) {
      if (m.start > pos) out.push({ text: paragraph.slice(pos, m.start) });
      const w = content.wordById.get(m.wordId)!;
      out.push({ text: paragraph.slice(m.start, m.end), info: { hr: w.hr, de: w.de.join(', ') } });
      pos = m.end;
      continue;
    }
    const g = gloss.get(fold(t.text));
    if (g) {
      if (t.start > pos) out.push({ text: paragraph.slice(pos, t.start) });
      out.push({ text: t.text, info: g });
      pos = t.end;
    }
  }
  if (pos < paragraph.length) out.push({ text: paragraph.slice(pos) });
  return out;
}

/** A longer reading text: listen, tap words for their meaning, check understanding. */
export function ReadingScreen() {
  const { textId = '' } = useParams();
  const navigate = useNavigate();
  const text = content.textById.get(textId);
  const [selected, setSelected] = useState<{ p: number; i: number }>();
  const [showDe, setShowDe] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const paragraphs = useMemo(() => (text ? text.hr.split(/\n\s*\n/) : []), [text]);
  const translations = useMemo(() => (text ? text.de.split(/\n\s*\n/) : []), [text]);
  const pieces = useMemo(() => paragraphs.map((p) => piecesFor(p, text?.glossary ?? [])), [paragraphs, text]);

  if (!text) return <p>Text nicht gefunden.</p>;
  const answered = Object.keys(answers).length;
  const correct = text.questions.filter((q, i) => answers[i] === q.answer).length;
  const sel = selected ? pieces[selected.p]![selected.i]!.info : undefined;

  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== undefined) return;
    const next = { ...answers, [qi]: oi };
    setAnswers(next);
    if (Object.keys(next).length === text.questions.length) {
      const c = text.questions.filter((q, i) => next[i] === q.answer).length;
      void saveTextResult(db, text.id, c, text.questions.length);
    }
  };

  return (
    <>
      <div className="page-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Zurück">
          <IconBack />
        </button>
        <div>
          <div className="muted small">Lesetext · {content.unitById.get(text.unitId)?.title}</div>
          <h1 className="page-title">{text.title}</h1>
        </div>
      </div>
      <div className="card read-tools">
        <span>Ganzen Text anhören</span>
        <SpeakButtons text={paragraphs.join(' ')} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Tippe auf ein Wort für seine Bedeutung.
      </p>
      <article className="card reading" lang="hr">
        {pieces.map((ps, p) => (
          <div key={p} className="read-para">
            <p>
              {ps.map((piece, i) =>
                piece.info ? (
                  <button
                    key={i}
                    type="button"
                    className={`read-word${selected?.p === p && selected.i === i ? ' active' : ''}`}
                    onClick={() => setSelected(selected?.p === p && selected.i === i ? undefined : { p, i })}
                  >
                    {piece.text}
                  </button>
                ) : (
                  <span key={i}>{piece.text}</span>
                ),
              )}
            </p>
            {showDe.has(p) ? (
              <p className="read-de" lang="de">
                {translations[p]}
              </p>
            ) : (
              <button type="button" className="link-btn" onClick={() => setShowDe((s) => new Set(s).add(p))}>
                Übersetzung
              </button>
            )}
          </div>
        ))}
      </article>
      {sel && (
        <div className="word-popup" role="status">
          <strong lang="hr">{sel.hr}</strong>
          <span>{sel.de}</span>
          <SpeakButtons text={sel.hr} size="sm" />
        </div>
      )}

      <h2 className="section-title">Verständnisfragen</h2>
      {text.questions.map((q, qi) => (
        <div key={qi} className="card question">
          <div className="question-text">{q.q}</div>
          <div className="choices">
            {q.options.map((o, oi) => {
              const a = answers[qi];
              const cls = a === undefined ? '' : oi === q.answer ? ' correct' : oi === a ? ' wrong' : '';
              return (
                <button key={oi} type="button" className={`choice${cls}`} disabled={a !== undefined} onClick={() => choose(qi, oi)}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {answered === text.questions.length && (
        <div className={`feedback ${correct === text.questions.length ? 'ok' : 'almost'}`} role="status">
          <div className="feedback-title">
            {correct} von {text.questions.length} richtig{correct === text.questions.length ? ' – sehr gut verstanden!' : ''}
          </div>
        </div>
      )}
    </>
  );
}
