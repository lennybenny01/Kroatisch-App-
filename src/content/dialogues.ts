import type { Dialogue } from '../domain/dialogue';
import data from './dialogues.json';

/** One everyday dialogue per unit, played at the end of the unit. */
export const dialogues = data as Dialogue[];
export const dialogueByUnit = new Map(dialogues.map((d) => [d.unitId, d]));
