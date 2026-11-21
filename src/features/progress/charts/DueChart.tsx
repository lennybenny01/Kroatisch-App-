const W = 340;
const H = 150;
const PAD = { t: 22, b: 26, l: 4, r: 4 };
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Rounded data-end, square at the baseline. */
function columnPath(x: number, w: number, top: number, base: number, r = 4): string {
  const h = base - top;
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${base}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${base}Z`;
}

/** Reviews due in the next 7 days – one series, value on each cap. */
export function DueChart({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const slot = (W - PAD.l - PAD.r) / days.length;
  const bw = Math.min(24, slot * 0.55);
  const base = H - PAD.b;
  const y = (v: number) => base - (v / max) * (base - PAD.t);
  const label = (day: string, i: number) => (i === 0 ? 'Heute' : i === 1 ? 'Morgen' : DAYS[new Date(`${day}T12:00:00`).getDay()]!);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Fällige Wiederholungen: ${days.map((d, i) => `${label(d.day, i)} ${d.count}`).join(', ')}`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="axis" />
        {days.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={d.day}>
              <path d={columnPath(cx - bw / 2, bw, y(d.count), base)} fill="var(--viz-1)" />
              <text x={cx} y={y(d.count) - 6} textAnchor="middle" className="cap-label">
                {d.count}
              </text>
              <text x={cx} y={H - 8} textAnchor="middle" className={`tick${i === 0 ? ' strong' : ''}`}>
                {label(d.day, i)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
