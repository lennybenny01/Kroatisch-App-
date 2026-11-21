import { useEffect, useState } from 'react';
import { HEAT_BINS, type CalendarCell } from '../../../domain/stats';
import { ChartTooltip } from './ChartTooltip';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CELL = 16;
const GAP = 3;
const LEFT = 22;
const TOP = 16;

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

/** Learning days as a calendar heatmap (one hue, light → dark), tap a day for details. */
export function CalendarHeatmap({ grid }: { grid: CalendarCell[][] }) {
  const [sel, setSel] = useState<{ w: number; d: number }>();
  // The readout closes by itself – on a phone there is no „mouse leave“.
  useEffect(() => {
    if (!sel) return;
    const t = setTimeout(() => setSel(undefined), 3500);
    return () => clearTimeout(t);
  }, [sel]);
  const W = LEFT + grid.length * (CELL + GAP);
  const H = TOP + 7 * (CELL + GAP);
  const cell = sel ? grid[sel.w]![sel.d]! : undefined;
  const activeDays = grid.flat().filter((c) => c.count > 0).length;

  return (
    <div className="chart">
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${activeDays} Lerntage in den letzten ${grid.length} Wochen`}>
          {grid.map((col, w) => {
            const first = col[0]!.day;
            const prev = grid[w - 1]?.[0]!.day;
            const newMonth = !prev || first.slice(5, 7) !== prev.slice(5, 7);
            return newMonth && w < grid.length - 1 ? (
              <text key={`m${w}`} x={LEFT + w * (CELL + GAP)} y={10} className="tick">
                {MONTHS[Number(first.slice(5, 7)) - 1]}
              </text>
            ) : null;
          })}
          {[0, 2, 4].map((d) => (
            <text key={d} x={0} y={TOP + d * (CELL + GAP) + CELL - 4} className="tick">
              {WEEKDAYS[d]}
            </text>
          ))}
          {grid.map((col, w) =>
            col.map((c, d) =>
              c.future ? null : (
                <rect
                  key={c.day}
                  x={LEFT + w * (CELL + GAP)}
                  y={TOP + d * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  fill={`var(--viz-heat-${c.level})`}
                  className={`heat-cell${sel?.w === w && sel.d === d ? ' selected' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${longDate(c.day)}: ${c.count} Antworten`}
                  onPointerDown={() => setSel({ w, d })}
                  onFocus={() => setSel({ w, d })}
                />
              ),
            ),
          )}
        </svg>
        {cell && (
          <ChartTooltip xPct={((LEFT + sel!.w * (CELL + GAP)) / W) * 100}>
            <div className="tt-title">{longDate(cell.day)}</div>
            <div className="tt-row">
              <strong>{cell.count}</strong>
              <span className="tt-name">{cell.count === 1 ? 'Antwort' : 'Antworten'}</span>
            </div>
          </ChartTooltip>
        )}
      </div>
      <div className="heat-legend" aria-label="Legende: Antworten pro Tag">
        <span className="muted">weniger</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="heat-swatch" style={{ background: `var(--viz-heat-${l})` }} title={l === 0 ? '0' : `ab ${HEAT_BINS[l - 1]}`} />
        ))}
        <span className="muted">mehr</span>
      </div>
    </div>
  );
}
