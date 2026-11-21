import { CONTENT_VERSION, content } from '../content';
import type { CardDef, CardRecord, ReviewLog, Settings } from '../domain/types';
import type { MetaEntry, PricajDB } from './db';
import { syncCards } from './repo';

export const BACKUP_FORMAT = 1;

export interface Backup {
  app: 'pricaj';
  format: number;
  exportedAt: string;
  contentVersion: number;
  cards: CardRecord[];
  reviewLogs: ReviewLog[];
  settings: Settings[];
  meta: MetaEntry[];
}

export async function createBackup(db: PricajDB, now = new Date()): Promise<Backup> {
  return db.transaction('r', db.cards, db.reviewLogs, db.settings, db.meta, async () => ({
    app: 'pricaj' as const,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    contentVersion: CONTENT_VERSION,
    cards: await db.cards.toArray(),
    reviewLogs: await db.reviewLogs.toArray(),
    settings: await db.settings.toArray(),
    meta: await db.meta.toArray(),
  }));
}

export function backupFileName(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `pricaj-backup-${d}.json`;
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates a parsed backup file; throws BackupError with a German message. */
export function parseBackup(raw: unknown): Backup {
  if (!isObj(raw) || raw.app !== 'pricaj') throw new BackupError('Das ist keine Pričaj!-Sicherungsdatei.');
  if (typeof raw.format !== 'number' || raw.format > BACKUP_FORMAT)
    throw new BackupError('Diese Sicherung stammt aus einer neueren Version der App. Bitte aktualisiere die App zuerst.');
  for (const key of ['cards', 'reviewLogs', 'settings', 'meta'] as const) {
    if (!Array.isArray(raw[key])) throw new BackupError('Die Sicherungsdatei ist unvollständig oder beschädigt.');
  }
  const cards = raw.cards as unknown[];
  const okCard = (c: unknown) =>
    isObj(c) && typeof c.id === 'string' && typeof c.due === 'number' && typeof c.state === 'number' && typeof c.stability === 'number';
  if (!cards.every(okCard)) throw new BackupError('Die Karten in der Sicherung sind beschädigt.');
  const okLog = (l: unknown) => isObj(l) && typeof l.cardId === 'string' && typeof l.ts === 'number' && typeof l.rating === 'number';
  if (!(raw.reviewLogs as unknown[]).every(okLog)) throw new BackupError('Der Lernverlauf in der Sicherung ist beschädigt.');
  return raw as unknown as Backup;
}

export interface ImportSummary {
  cards: number;
  reviews: number;
  exportedAt: string;
}

/**
 * Replaces all progress with the backup (atomically), then reconciles with the
 * current course: new content is added as new cards, removed content dropped.
 */
export async function restoreBackup(db: PricajDB, backup: Backup, defs: CardDef[] = content.cardDefs): Promise<ImportSummary> {
  await db.transaction('rw', db.cards, db.reviewLogs, db.settings, db.meta, async () => {
    await Promise.all([db.cards.clear(), db.reviewLogs.clear(), db.settings.clear(), db.meta.clear()]);
    await db.cards.bulkPut(backup.cards);
    // keep original ids so the order of the history is preserved
    await db.reviewLogs.bulkPut(backup.reviewLogs);
    await db.settings.bulkPut(backup.settings);
    await db.meta.bulkPut(backup.meta);
  });
  await syncCards(db, defs);
  return { cards: backup.cards.length, reviews: backup.reviewLogs.length, exportedAt: backup.exportedAt };
}
