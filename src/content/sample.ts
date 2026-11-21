import type { Sentence, Unit, Word } from '../domain/types';

/**
 * 20 sample words for developing and testing the learning system.
 * Real course content follows in later steps.
 */
export const CONTENT_VERSION = 1;

export const units: Unit[] = [
  { id: 'u01_pozdravi', order: 1, title: 'Begrüßen & Höflichkeit', level: 'A1', canDo: ['Ich kann grüßen, mich bedanken und verabschieden.'] },
  { id: 'u02_kafic', order: 2, title: 'Im Café', level: 'A1', canDo: ['Ich kann Getränke bestellen und bezahlen.'] },
  { id: 'u03_obitelj', order: 3, title: 'Familie & Zuhause', level: 'A1', canDo: ['Ich kann von meiner Familie erzählen.'] },
  { id: 'u04_svakodnevica', order: 4, title: 'Alltag', level: 'A1', canDo: ['Ich kann sagen, wo ich wohne und was ich trinke.'] },
];

export const words: Word[] = [
  // u01
  { id: 'w_bok', unitId: 'u01_pozdravi', hr: 'bok', de: ['hallo', 'tschüss'], pos: 'phrase', notes: 'Informell – zum Grüßen und Verabschieden.' },
  { id: 'w_dobar_dan', unitId: 'u01_pozdravi', hr: 'dobar dan', de: ['guten Tag'], pos: 'phrase' },
  { id: 'w_dovidenja', unitId: 'u01_pozdravi', hr: 'doviđenja', de: ['auf Wiedersehen'], pos: 'phrase', notes: 'đ klingt wie ein weiches „dsch“.' },
  { id: 'w_hvala', unitId: 'u01_pozdravi', hr: 'hvala', de: ['danke'], pos: 'phrase' },
  { id: 'w_molim', unitId: 'u01_pozdravi', hr: 'molim', de: ['bitte'], pos: 'phrase', notes: 'Auch: „Wie bitte?“' },
  { id: 'w_da', unitId: 'u01_pozdravi', hr: 'da', de: ['ja'], pos: 'other' },
  // u02
  { id: 'w_kava', unitId: 'u02_kafic', hr: 'kava', de: ['Kaffee'], pos: 'noun', gender: 'f' },
  { id: 'w_voda', unitId: 'u02_kafic', hr: 'voda', de: ['Wasser'], pos: 'noun', gender: 'f' },
  { id: 'w_caj', unitId: 'u02_kafic', hr: 'čaj', de: ['Tee'], pos: 'noun', gender: 'm' },
  { id: 'w_racun', unitId: 'u02_kafic', hr: 'račun', de: ['Rechnung'], pos: 'noun', gender: 'm' },
  { id: 'w_secer', unitId: 'u02_kafic', hr: 'šećer', de: ['Zucker'], pos: 'noun', gender: 'm' },
  // u03
  { id: 'w_majka', unitId: 'u03_obitelj', hr: 'majka', hrAlt: ['mama'], de: ['Mutter'], pos: 'noun', gender: 'f' },
  { id: 'w_otac', unitId: 'u03_obitelj', hr: 'otac', hrAlt: ['tata'], de: ['Vater'], pos: 'noun', gender: 'm' },
  { id: 'w_brat', unitId: 'u03_obitelj', hr: 'brat', de: ['Bruder'], pos: 'noun', gender: 'm' },
  { id: 'w_sestra', unitId: 'u03_obitelj', hr: 'sestra', de: ['Schwester'], pos: 'noun', gender: 'f' },
  { id: 'w_kuca', unitId: 'u03_obitelj', hr: 'kuća', de: ['Haus'], pos: 'noun', gender: 'f' },
  // u04
  { id: 'w_zivjeti', unitId: 'u04_svakodnevica', hr: 'živjeti', de: ['leben', 'wohnen'], pos: 'verb', aspect: 'impf' },
  { id: 'w_piti', unitId: 'u04_svakodnevica', hr: 'piti', de: ['trinken'], pos: 'verb', aspect: 'impf' },
  { id: 'w_govoriti', unitId: 'u04_svakodnevica', hr: 'govoriti', de: ['sprechen'], pos: 'verb', aspect: 'impf' },
  { id: 'w_danas', unitId: 'u04_svakodnevica', hr: 'danas', de: ['heute'], pos: 'adv' },
];

export const sentences: Sentence[] = [
  { id: 's_bok_kako', unitId: 'u01_pozdravi', hr: 'Bok, kako si?', de: 'Hallo, wie geht’s dir?', clozeWordId: 'w_bok', clozeForm: 'Bok' },
  { id: 's_hvala_lijepa', unitId: 'u01_pozdravi', hr: 'Hvala lijepa!', de: 'Vielen Dank!', clozeWordId: 'w_hvala', clozeForm: 'Hvala' },
  { id: 's_kavu', unitId: 'u02_kafic', hr: 'Molim jednu kavu.', de: 'Einen Kaffee, bitte.', clozeWordId: 'w_kava', clozeForm: 'kavu', clozeNote: 'Akkusativ von „kava“: -a → -u' },
  { id: 's_racun', unitId: 'u02_kafic', hr: 'Račun, molim!', de: 'Die Rechnung, bitte!', clozeWordId: 'w_racun', clozeForm: 'Račun' },
  { id: 's_caj', unitId: 'u02_kafic', hr: 'Pijem čaj bez šećera.', de: 'Ich trinke Tee ohne Zucker.', clozeWordId: 'w_caj', clozeForm: 'čaj', clozeNote: '„bez“ verlangt den Genitiv: šećer → šećera' },
  { id: 's_majka', unitId: 'u03_obitelj', hr: 'Moja majka živi u Splitu.', de: 'Meine Mutter lebt in Split.', clozeWordId: 'w_majka', clozeForm: 'majka' },
  { id: 's_brata', unitId: 'u03_obitelj', hr: 'Imam brata i sestru.', de: 'Ich habe einen Bruder und eine Schwester.', clozeWordId: 'w_brat', clozeForm: 'brata', clozeNote: 'Akkusativ belebt (m): brat → brata' },
  { id: 's_kuce', unitId: 'u03_obitelj', hr: 'Otac je kod kuće.', de: 'Der Vater ist zu Hause.', clozeWordId: 'w_kuca', clozeForm: 'kuće', clozeNote: '„kod“ verlangt den Genitiv: kuća → kuće' },
  { id: 's_vodu', unitId: 'u04_svakodnevica', hr: 'Danas pijem vodu.', de: 'Heute trinke ich Wasser.', clozeWordId: 'w_voda', clozeForm: 'vodu', clozeNote: 'Akkusativ von „voda“: -a → -u' },
  { id: 's_govorim', unitId: 'u04_svakodnevica', hr: 'Govorim malo hrvatski.', de: 'Ich spreche ein bisschen Kroatisch.', clozeWordId: 'w_govoriti', clozeForm: 'Govorim', clozeNote: 'govoriti → (ja) govorim' },
  { id: 's_zivim', unitId: 'u04_svakodnevica', hr: 'Živim u Njemačkoj.', de: 'Ich lebe in Deutschland.', clozeWordId: 'w_zivjeti', clozeForm: 'Živim', clozeNote: 'živjeti → (ja) živim' },
];
