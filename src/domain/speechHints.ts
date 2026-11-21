import type { RecognitionErrorCode } from '../lib/recognition';
import type { PlatformInfo } from '../lib/platform';

export interface SpeechHintText {
  title: string;
  body: string;
  /** Concrete steps for this device. */
  steps?: string;
  /** What happens instead. */
  fallback: string;
}

export type SpeechProblem =
  | { kind: 'tts-unsupported' }
  | { kind: 'tts-no-voice' }
  | { kind: 'recognition-unsupported' }
  | { kind: 'recognition-error'; code: RecognitionErrorCode }
  | { kind: 'recording-error'; name: string };

const TYPE = 'Du kannst die Antwort einfach eintippen.';
const READ = 'Du kannst die Sätze trotzdem lesen und laut mitsprechen.';

/** German explanation for a missing speech feature or a speech error, tailored to the device. */
export function speechHint(p: SpeechProblem, { platform, browser, standalone }: PlatformInfo): SpeechHintText {
  const ios = platform === 'ios';
  const android = platform === 'android';
  switch (p.kind) {
    case 'tts-unsupported':
      return {
        title: 'Vorlesen wird nicht unterstützt',
        body: 'Dieser Browser hat keine Sprachausgabe.',
        steps: ios ? 'Öffne Pričaj! in Safari.' : android ? 'Öffne Pričaj! in Chrome.' : 'Nutze einen aktuellen Browser wie Chrome, Edge oder Safari.',
        fallback: READ,
      };
    case 'tts-no-voice':
      return {
        title: 'Keine kroatische Stimme installiert',
        body: 'Für die Aussprache brauchst du eine kroatische Stimme auf deinem Gerät. Ohne sie würde eine deutsche Stimme Kroatisch falsch vorlesen – deshalb bleibt es still.',
        steps: ios
          ? 'iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Kroatisch → eine Stimme laden. Danach Pričaj! neu öffnen.'
          : android
            ? 'Android: Einstellungen → System → Sprachen → Sprachausgabe → Google-Sprachausgabe → Sprachdaten installieren → Kroatisch. Danach Chrome neu starten.'
            : 'Installiere in den Systemeinstellungen eine kroatische Stimme (Windows: Einstellungen → Zeit und Sprache → Sprache → Kroatisch hinzufügen).',
        fallback: READ,
      };
    case 'recognition-unsupported':
      return {
        title: 'Spracherkennung nicht verfügbar',
        body: 'Dieser Browser kann gesprochene Antworten nicht erkennen.',
        steps: ios
          ? standalone
            ? 'Auf dem iPhone funktioniert die Spracherkennung je nach iOS-Version nicht in der Home-Bildschirm-App. Öffne Pričaj! dann direkt in Safari (iOS 14.5 oder neuer).'
            : 'Du brauchst Safari ab iOS 14.5 und die eingeschaltete Diktierfunktion: Einstellungen → Allgemein → Tastatur → Diktierfunktion.'
          : android
            ? browser === 'chrome'
              ? 'Aktualisiere Chrome und die Google-App.'
              : 'Öffne Pričaj! in Chrome – dort funktioniert die Spracherkennung.'
            : 'Nutze Chrome, Edge oder Safari.',
        fallback: TYPE,
      };
    case 'recognition-error':
      return recognitionErrorHint(p.code, ios, android);
    case 'recording-error':
      return {
        title: 'Aufnahme nicht möglich',
        body: p.name === 'NotAllowedError' ? 'Der Zugriff auf das Mikrofon wurde nicht erlaubt.' : 'Das Mikrofon konnte nicht gestartet werden.',
        steps: micPermissionSteps(ios, android),
        fallback: READ,
      };
  }
}

function micPermissionSteps(ios: boolean, android: boolean): string {
  if (ios) return 'iPhone: Einstellungen → Safari → Mikrofon → „Erlauben“ (oder „Fragen“). Danach die Seite neu laden.';
  if (android) return 'Android: In Chrome auf das Symbol links neben der Adresse tippen → Berechtigungen → Mikrofon → Zulassen.';
  return 'Erlaube den Mikrofonzugriff über das Symbol in der Adressleiste.';
}

function recognitionErrorHint(code: RecognitionErrorCode, ios: boolean, android: boolean): SpeechHintText {
  switch (code) {
    case 'not-allowed':
      return { title: 'Mikrofon nicht erlaubt', body: 'Pričaj! darf das Mikrofon nicht benutzen.', steps: micPermissionSteps(ios, android), fallback: TYPE };
    case 'service-not-allowed':
      return {
        title: 'Spracherkennung ist ausgeschaltet',
        body: 'Der Dienst für die Spracherkennung ist auf diesem Gerät deaktiviert.',
        steps: ios
          ? 'iPhone: Einstellungen → Allgemein → Tastatur → Diktierfunktion einschalten. Für Kroatisch zusätzlich die kroatische Tastatur hinzufügen (Tastaturen → Tastatur hinzufügen → Kroatisch).'
          : 'Prüfe, ob die Spracheingabe von Google aktiviert ist (Google-App → Einstellungen → Sprache).',
        fallback: TYPE,
      };
    case 'network':
      return {
        title: 'Keine Verbindung zur Spracherkennung',
        body: ios
          ? 'Die Spracherkennung braucht hier eine Internetverbindung.'
          : 'Die Spracherkennung in Chrome läuft über einen Online-Dienst und braucht eine Internetverbindung.',
        fallback: 'Offline kannst du die Antwort eintippen.',
      };
    case 'no-speech':
      return { title: 'Nichts gehört', body: 'Tippe auf das Mikrofon und sprich die Antwort deutlich.', fallback: TYPE };
    case 'audio-capture':
      return { title: 'Kein Mikrofon gefunden', body: 'Es wurde kein Mikrofon erkannt.', fallback: TYPE };
    case 'language-not-supported':
      return {
        title: 'Kroatisch wird nicht erkannt',
        body: 'Die Spracherkennung auf diesem Gerät unterstützt kein Kroatisch.',
        steps: ios
          ? 'iPhone: Einstellungen → Allgemein → Tastatur → Tastaturen → Tastatur hinzufügen → Kroatisch. Dann ist auch die kroatische Diktierfunktion verfügbar.'
          : android
            ? 'Android: Google-App → Einstellungen → Sprache → Sprachen → Kroatisch hinzufügen.'
            : undefined,
        fallback: TYPE,
      };
    case 'unsupported':
      return { title: 'Spracherkennung nicht verfügbar', body: 'Dieser Browser kann gesprochene Antworten nicht erkennen.', fallback: TYPE };
    default:
      return { title: 'Das hat nicht geklappt', body: 'Die Spracherkennung wurde unterbrochen. Versuch es noch einmal.', fallback: TYPE };
  }
}
