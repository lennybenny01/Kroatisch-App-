import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { countNewIntroduced } from '../../db/repo';
import { dueCards, eligibleNewCards, newBudget } from '../../domain/session';
import type { CardRecord } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { dayKey } from '../../lib/date';

export interface TodayOverview {
  cards: CardRecord[];
  due: number;
  newAvailable: number;
  newToday: number;
  newLimit: number;
}

export function useTodayOverview(): TodayOverview | undefined {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [cards, newToday] = await Promise.all([db.cards.toArray(), countNewIntroduced(db, dayKey(Date.now()))]);
    return { cards, newToday };
  });
  if (!data) return undefined;
  const now = Date.now();
  const budget = newBudget(settings.newCardsPerDay, data.newToday);
  return {
    cards: data.cards,
    due: dueCards(data.cards, now).length,
    newAvailable: Math.min(budget, eligibleNewCards(data.cards).length),
    newToday: data.newToday,
    newLimit: settings.newCardsPerDay,
  };
}
