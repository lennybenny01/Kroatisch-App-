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

## Audio & Sprechen

- **Vorlesen** (Web Speech API, Stimme `hr-HR`): 🔊 normal und 🐢 langsam auf jeder Karte, im Feedback, bei Beispielsätzen und in der Kartenliste.
  Beim Lückentext und bei DE→HR erst nach dem Antworten (sonst wäre die Lösung verraten). Fehlt eine kroatische Stimme, bleibt es still –
  eine deutsche Stimme würde Kroatisch falsch vorlesen.
- **Sprech-Modus** (Einstellungen): Antwort per Mikrofon (`hr-HR` bzw. `de-DE`). Alle Kandidaten der Erkennung werden tolerant geprüft;
  als Ziffern erkannte Zahlen („5“) zählen wie das Wort („pet“). Das Mikrofon gibt es auch ohne Sprech-Modus neben dem Eingabefeld.
- **Shadowing** (Startseite): Satz hören → nachsprechen (mit Erkennung und Wort-für-Wort-Vergleich, mit Aufnahme oder ohne Mikrofon) → nochmal hören.
- **Rückfall:** Ohne Stimme, Spracherkennung, Mikrofon-Erlaubnis oder Internet erscheint ein Hinweis mit konkreten Schritten
  für iPhone bzw. Android (`src/domain/speechHints.ts`), und man tippt einfach.
- **Einstellungen → Audio & Mikrofon testen** zeigt, was auf dem eigenen Gerät funktioniert.

| Gerät | Vorlesen | Spracherkennung |
|---|---|---|
| iPhone, Safari | eingebaute kroatische Stimme (ggf. unter Bedienungshilfen → Gesprochene Inhalte laden) | Siri-Diktat ab iOS 14.5, Diktierfunktion muss an sein; als Home-Bildschirm-App je nach iOS-Version nicht verfügbar |
| Android, Chrome | Google-Sprachausgabe (Sprachdaten Kroatisch) | Google-Dienst, braucht Internet |
| Firefox, Samsung Internet | je nach System | nicht verfügbar → Tippen |

## Aussprache (Lektion 0)

Eigene Lektion vor Einheit 1, jederzeit über das Aussprache-Symbol (oben rechts, auch in der Lernsession) erreichbar.
Inhalte in `src/content/pronunciation.json`:

- Regeln: Man spricht, wie man schreibt · Betonung fast nie auf der letzten Silbe
- 12 Sonderlaute (c, č, ć, š, ž, dž, đ, lj, nj, r als Vokal, j, h), jeweils mit deutschem Vergleichswort,
  Hörbeispielen (TTS, langsam) und Übung: Wort hören → richtigen Buchstaben antippen
- Schwierige Paare nebeneinander: č/ć und dž/đ (hart gegen weich), abwechselnd anhören, eigene Übung
- Fehlt eine kroatische Stimme auf dem Gerät, zeigt die Lektion, wie man sie installiert.

## Inhalte

Standardkroatisch, ijekavisch. Eine Datei pro Einheit in `src/content/a1/` und `src/content/a2/`.

| Niveau | Einheiten | Wörter | Sätze | Grammatik |
|---|---|---|---|---|
| A1 | 1–7 (Begrüßung … Orte & Richtungen) | 310 | 162 | biti, imati, Präsens, Akkusativ, Lokativ, Genitiv nach Zahlen |
| A2 | 8–17 (Einkaufen, Restaurant, Weg, Arzt, Wohnung, Arbeit, Smalltalk, Wetter, Pläne, Urlaub am Meer) | 402 | 255 | Perfekt, Futur I, Verbaspekt, Modalverben, Imperativ, alle 7 Fälle im Singular |

Format einer Einheit:

```jsonc
{
  "id": "a1_04", "order": 4, "level": "A1", "title": "Essen & Trinken",
  "canDo": ["…"],
  "grammar": [{ "id": "g_akkusativ", "title": "…", "summary": "…", "body": ["…"], "table": { "head": [], "rows": [] } }],
  "words": [{
    "id": "w_kava", "hr": "kava", "de": ["Kaffee"], "pos": "noun", "gender": "f",
    "forms": ["kavu", "kave", "kavom"],            // gebeugte Formen, die in Sätzen vorkommen
    "example": { "hr": "…", "de": "…" },           // optional, wenn ein Übungssatz das Wort übt
    "note": "Serbisch: kafa."
  }],
  "sentences": [{ "id": "s_04_03", "hr": "Pijem kavu.", "de": "Ich trinke Kaffee.", "grammar": "g_akkusativ", "note": "kava → kavu" }]
}
```

- Verben haben `aspect` (`impf`/`pf`/`both`) und `aspectPartner` (oder `null`, wenn es keinen gibt).
- `addForms` (optional): neue Formen von Wörtern früherer Einheiten, z. B. Perfekt `bio` von biti oder Futur `ću` von htjeti.
- **i+1 automatisch:** Jeder Satz wird in Kurswörter zerlegt (Lemma, Alternativen, `forms`).
  Das *neueste* Wort des Satzes wird zur Lücke; die App zeigt den Satz erst, wenn alle anderen Wörter gesehen wurden.
- `src/content/content.test.ts` prüft u. a.: jeder Satz besteht nur aus Kurswörtern, genau ein neues Wort pro Satz,
  Nomen haben Genus, Verben Aspekt, jedes Wort hat einen Beispielsatz, keine serbischen/ekavischen Formen.
- **Einheiten freischalten:** Die nächste Einheit öffnet sich, sobald 80 % der Wörter der vorherigen „sitzen“
  (HR→DE-Karte in Wiederholung, Stabilität ≥ 3 Tage). Einmal freigeschaltet bleibt freigeschaltet.

## Struktur

```
src/
  app/        Shell, Navigation, Update-Hinweis
  content/    Lerninhalte (a1/*.json), Satzanalyse, Content-Aufbau; fixtures/ = 20 Testwörter
  db/         Dexie-Schema und Repository
  domain/     reine Logik: Scheduler, Session, Antwortprüfung, Übungen (+ Tests)
  features/   Screens: learn, progress, cards, settings
  hooks/, lib/, styles/
```
