import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { content } from '../content';
import { buildLookup, type Lookup } from '../content/lookup';
import { db } from '../db/db';

/** Course content merged with own cards (reactive). */
export function useLookup(): Lookup {
  const custom = useLiveQuery(() => db.customWords.toArray(), [], []);
  return useMemo(() => buildLookup(content, custom), [custom]);
}
