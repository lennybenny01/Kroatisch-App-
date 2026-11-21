import Dexie, { type Table } from 'dexie';
import type { CardRecord, CustomWord, ReviewLog, Settings } from '../domain/types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class PricajDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviewLogs!: Table<ReviewLog, number>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaEntry, string>;
  customWords!: Table<CustomWord, string>;

  constructor(name = 'pricaj') {
    super(name);
    this.version(1).stores({
      cards: 'id, due, state, unitId, kind, wordId',
      reviewLogs: '++id, cardId, ts, day, [day+stateBefore]',
      settings: 'id',
      meta: 'key',
    });
    // v2: own cards
    this.version(2).stores({ customWords: 'id, createdAt' });
  }
}

export const db = new PricajDB();
