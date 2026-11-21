import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { sentenceById, units, wordById } from '../../content';
import { db } from '../../db/db';
import { setSuspended } from '../../db/repo';
import { formatInterval } from '../../domain/scheduler';
import { CardState, type CardKind, type CardRecord } from '../../domain/types';
import { isUnlocked } from '../../domain/unlock';

const KIND: Record<CardKind, string> = { recognize: 'HR→DE', produce: 'DE→HR', cloze: 'Lücke' };
type Filter = 'all' | CardKind;

function status(c: CardRecord, locked: boolean, now: number): string {
  if (c.suspended) return 'pausiert';
  if (c.state === CardState.New) return locked ? 'gesperrt' : 'neu';
  if (c.due <= now) return 'fällig';
  return `in ${formatInterval(c.due - now)}`;
}

export function CardsScreen() {
  const cards = useLiveQuery(() => db.cards.orderBy('id').toArray());
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [unit, setUnit] = useState<string>('all');

  const rows = useMemo(() => {
    if (!cards) return [];
    const byId = new Map(cards.map((c) => [c.id, c]));
    const needle = q.trim().toLowerCase();
    return cards
      .filter((c) => (filter === 'all' || c.kind === filter) && (unit === 'all' || c.unitId === unit))
      .map((c) => {
        const w = wordById.get(c.wordId);
        const s = c.sentenceId ? sentenceById.get(c.sentenceId) : undefined;
        const title = c.kind === 'cloze' && s ? s.hr : w?.hr ?? c.id;
        const sub = c.kind === 'cloze' && s ? s.de : w?.de.join(', ') ?? '';
        return { c, title, sub, locked: !isUnlocked(c, (id) => byId.get(id)) };
      })
      .filter((r) => !needle || `${r.title} ${r.sub}`.toLowerCase().includes(needle))
      .sort((a, b) => a.c.order - b.c.order);
  }, [cards, q, filter, unit]);

  if (!cards) return null;
  const now = Date.now();

  return (
    <>
      <h1 className="page-title">Karten</h1>
      <input className="search" type="search" placeholder="Suchen (kroatisch oder deutsch)" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Tippe auf den Status, um eine Karte zu pausieren oder fortzusetzen.</p>
      <div className="segmented" role="group" aria-label="Kartentyp">
        {(['all', 'recognize', 'produce', 'cloze'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Alle' : KIND[f]}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Einheit">
        <button aria-pressed={unit === 'all'} onClick={() => setUnit('all')}>
          Alle
        </button>
        {units.map((u) => (
          <button key={u.id} aria-pressed={unit === u.id} onClick={() => setUnit(u.id)} title={u.title}>
            {u.order}. {u.title}
          </button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 14 }}>{rows.length} Karten</div>
      <div className="list">
        {rows.map(({ c, title, sub, locked }) => (
          <div key={c.id} className="list-item" style={c.suspended ? { opacity: 0.55 } : undefined}>
            <div className="grow">
              <div style={{ fontWeight: 650, overflowWrap: 'anywhere' }} lang="hr">{title}</div>
              <div className="muted" style={{ fontSize: 14 }}>{sub}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className="badge">{KIND[c.kind]}</span>
              <button
                className="badge"
                style={{ border: 'none', minHeight: 32 }}
                onClick={() => void setSuspended(db, c.id, !c.suspended)}
                aria-label={c.suspended ? 'Karte fortsetzen' : 'Karte pausieren'}
              >
                {status(c, locked, now)}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="list-item muted">Keine Karten gefunden.</div>}
      </div>
    </>
  );
}
