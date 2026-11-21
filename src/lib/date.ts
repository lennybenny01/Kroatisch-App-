/** Hour at which a new learning day starts (like Anki: late-night reviews count for the previous day). */
export const DAY_ROLLOVER_HOUR = 4;

/** Local calendar day "YYYY-MM-DD" a timestamp belongs to, respecting the rollover hour. */
export function dayKey(ts: number, rolloverHour = DAY_ROLLOVER_HOUR): string {
  const d = new Date(ts - rolloverHour * 3_600_000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
