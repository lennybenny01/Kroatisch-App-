import { useRef, useState, type PointerEvent } from 'react';
import type { AccuracyPoint } from '../../../domain/stats';
import { ChartTooltip, TooltipRow } from './ChartTooltip';

const W = 340;
const H = 190;
const PAD = { l: 34, r: 40, t: 12, b: 24 };
const SERIES = [
  { key: 'verstehen', name: 'Verstehen (HR → DE)', color: 'var(--viz-1)' },
  { key: 'sprechen', name: 'Sprechen (DE → HR, Lücke)', color: 'var(--viz-2)' },
] as const;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const shortDate = (day: string) => {
  const [, m, d] = day.split('-');
  return `${Number(d)}.${Number(m)}.`;
};

/** Accuracy per week, two series on one 0–100 % axis, crosshair readout. */
export function AccuracyChart({ points }: { points: AccuracyPoint[] }) {
  const [hover, setHover] = useState<number>();
  const svgRef = useRef<SVGSVGElement>(null);
  const n = points.length;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, n - 1);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);

  const segments = (key: 'verstehen' | 'sprechen') => {
    const out: string[] = [];
    let cur = '';
    points.forEach((p, i) => {
      const v = p[key];
      if (!v) {
        if (cur) out.push(cur);
        cur = '';
        return;
      }
      cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v.rate).toFixed(1)}`;
    });
    if (cur) out.push(cur);
    return out;
  };
  const lastIndex = (key: 'verstehen' | 'sprechen') => {
    for (let i = n - 1; i >= 0; i--) if (points[i]![key]) return i;
    return -1;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hp = hover !== undefined ? points[hover] : undefined;
  const labelIdx = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="chart">
      <div className="legend" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="legend-line" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="chart-plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Trefferquote pro Woche für Verstehen und Sprechen"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(undefined)}
          style={{ touchAction: 'pan-y' }}
        >
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis' : 'grid'} />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="tick">
                {v * 100}%
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="tick">
              {shortDate(points[i]!.week)}
            </text>
          ))}
          {hp && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />}
          {SERIES.map((s) => (
            <g key={s.key}>
              {segments(s.key).map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {/* single points (no neighbours) still visible */}
              {points.map((p, i) => {
                const v = p[s.key];
                const isolated = v && !points[i - 1]?.[s.key] && !points[i + 1]?.[s.key];
                const isEnd = i === lastIndex(s.key);
                const isHover = i === hover && v;
                return v && (isolated || isEnd || isHover) ? (
                  <circle key={i} cx={x(i)} cy={y(v.rate)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ) : null;
              })}
            </g>
          ))}
          {/* direct labels: value at the line end only */}
          {SERIES.map((s, k) => {
            const i = lastIndex(s.key);
            if (i < 0) return null;
            const v = points[i]![s.key]!;
            const other = points[lastIndex(SERIES[1 - k]!.key)]?.[SERIES[1 - k]!.key];
            // nudge apart if both ends are close
            const dy = other && Math.abs(other.rate - v.rate) < 0.08 ? (v.rate >= other.rate ? -7 : 7) : 0;
            return (
              <text key={s.key} x={x(i) + 8} y={y(v.rate) + 4 + dy} className="end-label">
                {pct(v.rate)}
              </text>
            );
          })}
        </svg>
        {hp && (
          <ChartTooltip xPct={(x(hover!) / W) * 100}>
            <div className="tt-title">Woche ab {shortDate(hp.week)}</div>
            {SERIES.map((s) => {
              const v = hp[s.key];
              return <TooltipRow key={s.key} color={s.color} value={v ? pct(v.rate) : '–'} name={v ? `${s.name.split(' (')[0]} · ${v.n} Antworten` : s.name.split(' (')[0]!} />;
            })}
          </ChartTooltip>
        )}
      </div>
      <details className="table-view">
        <summary>Als Tabelle</summary>
        <table>
          <thead>
            <tr>
              <th>Woche ab</th>
              <th>Verstehen</th>
              <th>Sprechen</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week}>
                <td>{shortDate(p.week)}</td>
                <td>{p.verstehen ? `${pct(p.verstehen.rate)} (${p.verstehen.n})` : '–'}</td>
                <td>{p.sprechen ? `${pct(p.sprechen.rate)} (${p.sprechen.n})` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
