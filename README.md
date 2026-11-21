# Pričaj! – Kroatisch lernen

Progressive Web App zum Kroatischlernen für deutsche Muttersprachler – mit dem Ziel, frei zu sprechen.
Läuft komplett offline, alle Daten bleiben lokal (IndexedDB).

## Entwickeln

```bash
npm install
npm run dev        # Dev-Server
npm test           # Tests (Vitest)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen (inkl. Service Worker)
npm run icons      # PNG-Icons aus public/icons/icon.svg erzeugen
```

## Lernsystem

- **FSRS** (`ts-fsrs`) plant jede Karte; Bewertung: Nochmal / Schwer / Gut / Leicht.
- **Active Recall**: Antworten werden getippt. Multiple Choice nur beim allerersten Kontakt mit einer neuen Karte.
- **Kartentypen** pro Wort: Verstehen (HR→DE), Sprechen (DE→HR), Lückentext im Satz.
  DE→HR wird erst freigeschaltet, wenn HR→DE sitzt (Review, Stabilität ≥ 3 Tage);
  der Lückentext, sobald das Wort die Lernphase verlassen hat.
- **Interleaving**: fällige Karten round-robin über Themen, neue Karten gleichmäßig dazwischen,
  nie zwei Karten desselben Worts direkt hintereinander.
- **Tolerante Eingabe**: fehlende Háčeks („kuca“) = fast richtig mit Hinweis; Tippfehler nur bei
  deutschen Antworten (im Kroatischen ist ein Buchstabe oft Grammatik: kava/kavu).
  Grundform statt gebeugter Form im Lückentext wird erkannt („falsche Form“).
- Sonderzeichen-Leiste (č ć š ž đ) sitzt über der Handytastatur.

## Struktur

```
src/
  app/        Shell, Navigation, Update-Hinweis
  content/    Lerninhalte (derzeit 20 Beispielwörter)
  db/         Dexie-Schema und Repository
  domain/     reine Logik: Scheduler, Session, Antwortprüfung, Übungen (+ Tests)
  features/   Screens: learn, progress, cards, settings
  hooks/, lib/, styles/
```
