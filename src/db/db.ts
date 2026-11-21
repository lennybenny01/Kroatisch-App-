import Dexie, { type Table } from 'dexie';
import type { CardRecord, ReviewLog, Settings } from '../domain/types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class PricajDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviewLogs!: Table<ReviewLog, number>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'pricaj') {
    super(name);
    this.version(1).stores({
      cards: 'id, due, state, unitId, kind, wordId',
      reviewLogs: '++id, cardId, ts, day, [day+stateBefore]',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new PricajDB();
