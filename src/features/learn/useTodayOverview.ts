import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { content } from '../../content';
import { db } from '../../db/db';
import { countNewIntroduced, getStoredUnlockedUnits, refreshUnlockedUnits } from '../../db/repo';
import { dueCards, eligibleNewCards, newBudget } from '../../domain/session';
import type { CardRecord } from '../../domain/types';
import { computeUnlockedUnits } from '../../domain/units';
import { useSettings } from '../../hooks/useSettings';
import { dayKey } from '../../lib/date';

export interface TodayOverview {
  cards: CardRecord[];
  unlocked: Set<string>;
  due: number;
  newAvailable: number;
  newToday: number;
  newLimit: number;
}

export function useTodayOverview(): TodayOverview | undefined {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [cards, newToday, stored] = await Promise.all([
      db.cards.toArray(),
      countNewIntroduced(db, dayKey(Date.now())),
      getStoredUnlockedUnits(db),
    ]);
    return { cards, newToday, stored };
  });
  const unlocked = data ? computeUnlockedUnits(content.units, data.cards, data.stored) : undefined;
  const changed = !!data && !!unlocked && unlocked.size !== new Set(data.stored).size;
  useEffect(() => {
    if (changed) void refreshUnlockedUnits(db);
  }, [changed]);

  if (!data || !unlocked) return undefined;
  const now = Date.now();
  const budget = newBudget(settings.newCardsPerDay, data.newToday);
  return {
    cards: data.cards,
    unlocked,
    due: dueCards(data.cards, now).length,
    newAvailable: Math.min(budget, eligibleNewCards(data.cards, unlocked).length),
    newToday: data.newToday,
    newLimit: settings.newCardsPerDay,
  };
}
