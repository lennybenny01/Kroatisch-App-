import { useState } from 'react';
import { content } from '../../content';
import { GrammarDetails } from '../../components/GrammarDetails';
import { CardState, type CardRecord } from '../../domain/types';
import { UNIT_UNLOCK_THRESHOLD, unitMastery } from '../../domain/units';

type Status = 'done' | 'active' | 'locked';

/** The course as a vertical path of units. */
export function LearningPath({ cards, unlocked }: { cards: CardRecord[]; unlocked: ReadonlySet<string> }) {
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
      {rows.map(({ u, m, status, seen, next }) => {
        const open = openId === u.id;
        const pct = Math.round(m.ratio * 100);
        return (
          <li key={u.id} className={`path-item ${status}${open ? ' open' : ''}`}>
            <button className="path-node" onClick={() => setOpenId(open ? undefined : u.id)} aria-expanded={open}>
              <span className="path-dot" aria-hidden>
                {status === 'done' ? '✓' : status === 'locked' ? '🔒' : u.order}
              </span>
              <span className="path-text">
                <span className="path-title">{u.title}</span>
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
        );
      })}
    </ol>
  );
}
