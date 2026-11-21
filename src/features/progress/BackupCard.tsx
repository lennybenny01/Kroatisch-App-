import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { backupFileName, BackupError, createBackup, parseBackup, restoreBackup } from '../../db/backup';
import { db } from '../../db/db';

const LAST_BACKUP = 'lastBackupAt';

/** Save progress as a file (share sheet on phones) and restore it. */
export function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const last = useLiveQuery(async () => (await db.meta.get(LAST_BACKUP))?.value as string | undefined);

  const save = async () => {
    setMsg(undefined);
    const now = new Date();
    const data = await createBackup(db, now);
    const json = JSON.stringify(data);
    const name = backupFileName(now);
    const file = new File([json], name, { type: 'application/json' });
    try {
      // Phones: share sheet → „In Dateien sichern“ / Google Drive …
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Pričaj! Backup' });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      await db.meta.put({ key: LAST_BACKUP, value: now.toISOString() });
      setMsg({ ok: true, text: `Gesichert: ${data.cards.length} Karten, ${data.reviewLogs.length} Antworten.` });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // share sheet closed
      setMsg({ ok: false, text: 'Die Sicherung konnte nicht gespeichert werden.' });
    }
  };

  const load = async (f: File) => {
    setMsg(undefined);
    try {
      const backup = parseBackup(JSON.parse(await f.text()));
      const date = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('de-DE') : 'unbekannt';
      if (!confirm(`Sicherung vom ${date} mit ${backup.reviewLogs.length} Antworten laden?\n\nDein aktueller Fortschritt auf diesem Gerät wird dabei ersetzt.`)) return;
      const r = await restoreBackup(db, backup);
      setMsg({ ok: true, text: `Wiederhergestellt: ${r.cards} Karten, ${r.reviews} Antworten.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof BackupError ? e.message : 'Die Datei konnte nicht gelesen werden. Ist es eine Pričaj!-Sicherung (.json)?' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="card" aria-label="Backup">
      <h2 className="card-title">Backup</h2>
      <p className="muted card-sub">
        Dein Fortschritt liegt nur auf diesem Gerät. Sichere ihn als Datei – zum Beispiel, bevor du das Handy wechselst.
        {last ? ` Letzte Sicherung: ${new Date(last).toLocaleDateString('de-DE')}.` : ' Noch keine Sicherung.'}
      </p>
      <div className="footer-row">
        <button className="btn" onClick={() => void save()}>
          ⬇️ Sichern
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆️ Laden
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
      {msg && (
        <div className={`feedback ${msg.ok ? 'ok' : 'bad'}`} role="status" style={{ marginTop: 10 }}>
          <div className="feedback-title">{msg.text}</div>
        </div>
      )}
    </section>
  );
}
