import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { content } from '../../content';
import { GrammarDetails } from '../../components/GrammarDetails';
import { CardState, type CardRecord } from '../../domain/types';
import { isDialogueAvailable, UNIT_UNLOCK_THRESHOLD, unitMastery, unitSeenRatio } from '../../domain/units';
import { dialogueByUnit } from '../../content/dialogues';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { getDialogueResults, getTextResults } from '../../db/repo';
import { content as courseContent } from '../../content';

type Status = 'done' | 'active' | 'locked';

const LEVEL_LABEL: Record<string, string> = {
  A1: 'Grundlagen – erste Wörter und Sätze',
  A2: 'Alltag – Einkaufen, Arzt, Arbeit, Urlaub',
  B1: 'Selbstständig – Meinungen, Erzählen, Konditional',
  B2: 'Fließend – Texte, Redewendungen, Umgangssprache',
};

/** The course as a vertical path of units. */
export function LearningPath({
  cards,
  unlocked,
  pronunciation,
}: {
  cards: CardRecord[];
  unlocked: ReadonlySet<string>;
  pronunciation: { done: boolean; practised: number; total: number };
}) {
  const navigate = useNavigate();
  const textResults = useLiveQuery(() => getTextResults(db), [], {} as Awaited<ReturnType<typeof getTextResults>>);
  const dialogueResults = useLiveQuery(() => getDialogueResults(db), [], {} as Awaited<ReturnType<typeof getDialogueResults>>);
  const rows = content.units.map((u, i) => {
    const m = unitMastery(u.id, cards);
    const next = content.units[i + 1];
    const status: Status = !unlocked.has(u.id) ? 'locked' : m.ratio >= UNIT_UNLOCK_THRESHOLD ? 'done' : 'active';
    const seen = cards.filter((c) => c.unitId === u.id && c.kind === 'recognize' && c.state !== CardState.New).length;
    return { u, m, status, seen, next };
  });
  const current = rows.find((r) => r.status === 'active') ?? rows.filter((r) => r.status !== 'locked').at(-1);
  const [openId, setOpenId] = useState<string | undefined>(current?.u.id);

  return (
    <ol className="path" aria-label="Lernpfad">
      <li className={`path-item ${pronunciation.done ? 'done' : 'active'}`}>
        <button className="path-node" onClick={() => navigate('/pronunciation')}>
          <span className="path-dot" aria-hidden>
            {pronunciation.done ? '✓' : 'Aa'}
          </span>
          <span className="path-text">
            <span className="path-title">Aussprache</span>
            <span className="path-sub">
              {pronunciation.done
                ? 'Abgeschlossen · jederzeit nachschlagen'
                : `Lektion 0 · ${pronunciation.practised}/${pronunciation.total} Übungen`}
            </span>
          </span>
        </button>
      </li>
      {rows.map(({ u, m, status, seen, next }, i) => {
        const open = openId === u.id;
        const pct = Math.round(m.ratio * 100);
        const levelStart = i === 0 || rows[i - 1]!.u.level !== u.level;
        return (
          <Fragment key={u.id}>
          {levelStart && (
            <li className="path-level" aria-label={`Niveau ${u.level}`}>
              <span className="path-level-badge">{u.level}</span>
              <span className="muted">{LEVEL_LABEL[u.level] ?? ''}</span>
            </li>
          )}
          <li className={`path-item ${status}${open ? ' open' : ''}`}>
            <button className="path-node" onClick={() => setOpenId(open ? undefined : u.id)} aria-expanded={open}>
              <span className="path-dot" aria-hidden>
                {status === 'done' ? '✓' : status === 'locked' ? '🔒' : u.order}
              </span>
              <span className="path-text">
                <span className="path-title">
                  {u.title}
                  {dialogueByUnit.get(u.id) && dialogueResults[dialogueByUnit.get(u.id)!.id] && (
                    <span className="path-badge" title="Dialog geschafft"> 💬✓</span>
                  )}
                </span>
                <span className="path-sub">
                  {status === 'locked'
                    ? 'Gesperrt'
                    : `${pct} % beherrscht · ${seen}/${m.total} Wörter gesehen`}
                </span>
              </span>
            </button>
            {status !== 'locked' && (
              <div className="progress-bar path-progress" aria-hidden>
                <div style={{ width: `${pct}%` }} />
              </div>
            )}
            {open && (
              <div className="path-details">
                {u.description && <p className="muted">{u.description}</p>}
                {status === 'locked' && (
                  <p className="path-hint">Wird freigeschaltet, sobald du 80 % der vorherigen Einheit beherrschst.</p>
                )}
                {status === 'active' && next && (
                  <p className="path-hint">
                    Noch {Math.max(0, Math.ceil(m.total * UNIT_UNLOCK_THRESHOLD) - m.mastered)} Wörter bis „{next.title}“ freigeschaltet wird.
                  </p>
                )}
                {(() => {
                  const d = dialogueByUnit.get(u.id);
                  if (!d || status === 'locked') return null;
                  const available = isDialogueAvailable(u.id, cards);
                  const result = dialogueResults[d.id];
                  return (
                    <div className="dialogue-entry">
                      <button className="btn btn-block" disabled={!available} onClick={() => navigate(`/dialogue/${u.id}`)}>
                        💬 Dialog: {d.title}
                        {result ? ` · ${Math.round(result.best * 100)} %` : ''}
                      </button>
                      {!available && (
                        <div className="muted small">
                          Am Ende der Einheit: verfügbar, sobald du alle Wörter gesehen hast ({Math.round(unitSeenRatio(u.id, cards) * 100)} %).
                        </div>
                      )}
                    </div>
                  );
                })()}
                {status !== 'locked' &&
                  courseContent.texts
                    .filter((t) => t.unitId === u.id)
                    .map((t) => (
                      <button key={t.id} className="btn btn-block" onClick={() => navigate(`/read/${t.id}`)}>
                        📖 Lesetext: {t.title}
                        {textResults[t.id] ? ` · ${textResults[t.id]!.correct}/${textResults[t.id]!.total}` : ''}
                      </button>
                    ))}
                <div className="section-title">Lernziele</div>
                <ul className="can-do">
                  {u.canDo.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="section-title">Grammatik</div>
                {u.grammarIds.map((id) => {
                  const g = content.grammarById.get(id);
                  return g ? <GrammarDetails key={id} topic={g} /> : null;
                })}
              </div>
            )}
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
