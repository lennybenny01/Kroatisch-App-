import type { ReactNode } from 'react';

/** Floating readout inside a chart container (position in % of the container). */
export function ChartTooltip({ xPct, children }: { xPct: number; children: ReactNode }) {
  // Keep the box inside the card: anchor left/right near the edges.
  const style = xPct < 30 ? { left: `${xPct}%` } : xPct > 70 ? { right: `${100 - xPct}%` } : { left: `${xPct}%`, transform: 'translateX(-50%)' };
  return (
    <div className="chart-tooltip" role="status" style={style}>
      {children}
    </div>
  );
}

/** A tooltip row: line key in the series colour, value strong, name secondary. */
export function TooltipRow({ color, value, name }: { color: string; value: string; name: string }) {
  return (
    <div className="tt-row">
      <span className="tt-key" style={{ background: color }} aria-hidden />
      <strong>{value}</strong>
      <span className="tt-name">{name}</span>
    </div>
  );
}
