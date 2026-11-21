import { db } from '../../db/db';
import { resetProgress, updateSettings } from '../../db/repo';
import type { Settings } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { useNavigate } from 'react-router-dom';
import { useSpeechSupport } from '../../hooks/useSpeechSupport';

const THEMES: { value: Settings['theme']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

export function SettingsScreen() {
  const s = useSettings();
  const navigate = useNavigate();
  const speech = useSpeechSupport();
  const set = (patch: Partial<Omit<Settings, 'id'>>) => void updateSettings(db, patch);
  const clampNew = (n: number) => Math.min(50, Math.max(0, n));

  return (
    <>
      <h1 className="page-title">Einstellungen</h1>

      <h2 className="section-title">Tagesziel</h2>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>Neue Karten pro Tag</div>
          <div className="muted" style={{ fontSize: 14 }}>Fällige Wiederholungen kommen immer zusätzlich.</div>
        </div>
        <div className="stepper">
          <button aria-label="Weniger" onClick={() => set({ newCardsPerDay: clampNew(s.newCardsPerDay - (s.newCardsPerDay > 10 ? 5 : 1)) })}>
            −
          </button>
          <output aria-live="polite">{s.newCardsPerDay}</output>
          <button aria-label="Mehr" onClick={() => set({ newCardsPerDay: clampNew(s.newCardsPerDay + (s.newCardsPerDay >= 10 ? 5 : 1)) })}>
            +
          </button>
        </div>
      </div>

      <h2 className="section-title">Antworten</h2>
      <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>Sonderzeichen streng prüfen</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Aus: „kuca“ statt „kuća“ zählt als fast richtig. An: zählt als falsch.
          </div>
        </div>
        <input type="checkbox" className="switch" checked={s.strictDiacritics} onChange={(e) => set({ strictDiacritics: e.target.checked })} />
      </label>

      <h2 className="section-title">Darstellung</h2>
      <div className="segmented" role="group" aria-label="Farbschema">
        {THEMES.map((t) => (
          <button key={t.value} aria-pressed={s.theme === t.value} onClick={() => set({ theme: t.value })}>
            {t.label}
          </button>
        ))}
      </div>

      <h2 className="section-title">Audio & Sprechen</h2>
      <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>Lösung automatisch vorlesen</div>
          <div className="muted" style={{ fontSize: 14 }}>Nach jeder Antwort wird das kroatische Wort bzw. der Satz vorgelesen.</div>
        </div>
        <input type="checkbox" className="switch" checked={s.autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
      </label>
      <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650 }}>Sprech-Modus</div>
          <div className="muted" style={{ fontSize: 14 }}>
            {speech.recognition
              ? 'Antworten zuerst per Mikrofon sprechen. Tippen bleibt jederzeit möglich.'
              : 'Dein Browser hat keine Spracherkennung – du antwortest per Tippen.'}
          </div>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={s.speakAnswers && speech.recognition}
          disabled={!speech.recognition}
          onChange={(e) => set({ speakAnswers: e.target.checked })}
        />
      </label>
      <button className="btn btn-block" onClick={() => navigate('/speech-test')}>
        🎙 Audio & Mikrofon testen
      </button>

      <h2 className="section-title">Daten</h2>
      <button
        className="btn btn-block"
        style={{ color: 'var(--bad)' }}
        onClick={() => {
          if (confirm('Wirklich den gesamten Lernfortschritt löschen? Das kann nicht rückgängig gemacht werden.')) void resetProgress(db);
        }}
      >
        Lernfortschritt zurücksetzen
      </button>
      <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
        Pričaj! · Version {__APP_VERSION__} · Alle Daten bleiben auf diesem Gerät.
      </p>
    </>
  );
}
