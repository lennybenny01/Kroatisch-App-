import type { StatusCounts } from '../../../domain/stats';

const PARTS = [
  { key: 'neu', name: 'neu', n: 1 },
  { key: 'lernen', name: 'im Lernen', n: 2 },
  { key: 'gefestigt', name: 'gefestigt', n: 3 },
] as const;

/** Tall segmented bar: one whole split into new / learning / consolidated (ordinal ramp). */
export function StatusBar({ title, counts }: { title: string; counts: StatusCounts }) {
  const total = counts.neu + counts.lernen + counts.gefestigt;
  const share = (k: keyof StatusCounts) => (total ? counts[k] / total : 0);
  // A part shows its number inside only if it is wide enough.
  const fits = (k: keyof StatusCounts) => share(k) >= 0.14;
  return (
    <div className="status-block">
      <div className="status-head">
        <span className="status-title">{title}</span>
        <span className="muted">{total} insgesamt</span>
      </div>
      <div className="seg-bar" role="img" aria-label={`${title}: ${PARTS.map((p) => `${counts[p.key]} ${p.name}`).join(', ')}`}>
        {PARTS.map((p) =>
          counts[p.key] > 0 ? (
            <div
              key={p.key}
              className="seg"
              style={{ flexGrow: counts[p.key], background: `var(--viz-ord-${p.n})`, color: `var(--viz-ord-${p.n}-ink)` }}
              title={`${p.name}: ${counts[p.key]}`}
            >
              {fits(p.key) ? counts[p.key] : ''}
            </div>
          ) : null,
        )}
      </div>
      <div className="seg-legend">
        {PARTS.map((p) => (
          <span key={p.key} className="legend-item">
            <span className="legend-rect" style={{ background: `var(--viz-ord-${p.n})` }} />
            {p.name}
            {!fits(p.key) && <span className="muted"> {counts[p.key]}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
