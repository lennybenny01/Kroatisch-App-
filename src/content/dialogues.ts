import type { Dialogue } from '../domain/dialogue';
import a from './dialogues.json';

/** Further levels add their dialogues as dialogues-<level>.json. */
const more = Object.entries(import.meta.glob('./dialogues-*.json', { eager: true }))
  .sort(([x], [y]) => x.localeCompare(y))
  .flatMap(([, m]) => ((m as { default?: unknown }).default ?? m) as Dialogue[]);

/** One everyday dialogue per unit, played at the end of the unit. */
export const dialogues = [...(a as Dialogue[]), ...more];
export const dialogueByUnit = new Map(dialogues.map((d) => [d.unitId, d]));
