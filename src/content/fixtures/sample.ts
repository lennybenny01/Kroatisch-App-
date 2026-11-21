import { buildContent } from '../build';
import type { UnitFile } from '../schema';

/**
 * 20 sample words – a small, stable fixture so the algorithm tests do not
 * depend on the real course content.
 */
const u = (id: string, order: number, title: string, words: UnitFile['words'], sentences: UnitFile['sentences'] = []): UnitFile => ({
  id,
  order,
  level: 'A1',
  title,
  canDo: [],
  grammar: [],
  words,
  sentences,
});

export const sampleFiles: UnitFile[] = [
  u('u01_pozdravi', 1, 'Begrüßen & Höflichkeit', [
    { id: 'w_bok', hr: 'bok', de: ['hallo', 'tschüss'], pos: 'phrase' },
    { id: 'w_dobar_dan', hr: 'dobar dan', de: ['guten Tag'], pos: 'phrase' },
    { id: 'w_dovidenja', hr: 'doviđenja', de: ['auf Wiedersehen'], pos: 'phrase' },
    { id: 'w_hvala', hr: 'hvala', de: ['danke'], pos: 'phrase' },
    { id: 'w_molim', hr: 'molim', de: ['bitte'], pos: 'phrase' },
    { id: 'w_da', hr: 'da', de: ['ja'], pos: 'particle' },
  ], [
    { id: 's_bok_kako', hr: 'Bok, kako si?', de: 'Hallo, wie geht’s dir?', cloze: 'w_bok' },
    { id: 's_hvala_lijepa', hr: 'Hvala lijepa!', de: 'Vielen Dank!', cloze: 'w_hvala' },
  ]),
  u('u02_kafic', 2, 'Im Café', [
    { id: 'w_kava', hr: 'kava', de: ['Kaffee'], pos: 'noun', gender: 'f', forms: ['kavu'] },
    { id: 'w_voda', hr: 'voda', de: ['Wasser'], pos: 'noun', gender: 'f', forms: ['vodu'] },
    { id: 'w_caj', hr: 'čaj', de: ['Tee'], pos: 'noun', gender: 'm' },
    { id: 'w_racun', hr: 'račun', de: ['Rechnung'], pos: 'noun', gender: 'm' },
    { id: 'w_secer', hr: 'šećer', de: ['Zucker'], pos: 'noun', gender: 'm', forms: ['šećera'] },
  ], [
    { id: 's_kavu', hr: 'Molim jednu kavu.', de: 'Einen Kaffee, bitte.', cloze: 'w_kava', note: 'Akkusativ von „kava“: -a → -u' },
    { id: 's_racun', hr: 'Račun, molim!', de: 'Die Rechnung, bitte!', cloze: 'w_racun' },
    { id: 's_caj', hr: 'Pijem čaj bez šećera.', de: 'Ich trinke Tee ohne Zucker.', cloze: 'w_caj' },
  ]),
  u('u03_obitelj', 3, 'Familie & Zuhause', [
    { id: 'w_majka', hr: 'majka', hrAlt: ['mama'], de: ['Mutter'], pos: 'noun', gender: 'f' },
    { id: 'w_otac', hr: 'otac', hrAlt: ['tata'], de: ['Vater'], pos: 'noun', gender: 'm' },
    { id: 'w_brat', hr: 'brat', de: ['Bruder'], pos: 'noun', gender: 'm', forms: ['brata'] },
    { id: 'w_sestra', hr: 'sestra', de: ['Schwester'], pos: 'noun', gender: 'f' },
    { id: 'w_kuca', hr: 'kuća', de: ['Haus'], pos: 'noun', gender: 'f', forms: ['kuće'] },
  ], [
    { id: 's_majka', hr: 'Moja majka živi u Splitu.', de: 'Meine Mutter lebt in Split.', cloze: 'w_majka' },
    { id: 's_brata', hr: 'Imam brata i sestru.', de: 'Ich habe einen Bruder und eine Schwester.', cloze: 'w_brat' },
    { id: 's_kuce', hr: 'Otac je kod kuće.', de: 'Der Vater ist zu Hause.', cloze: 'w_kuca' },
  ]),
  u('u04_svakodnevica', 4, 'Alltag', [
    { id: 'w_zivjeti', hr: 'živjeti', de: ['leben', 'wohnen'], pos: 'verb', aspect: 'impf', aspectPartner: null, forms: ['živim'] },
    { id: 'w_piti', hr: 'piti', de: ['trinken'], pos: 'verb', aspect: 'impf', aspectPartner: 'popiti', forms: ['pijem'] },
    { id: 'w_govoriti', hr: 'govoriti', de: ['sprechen'], pos: 'verb', aspect: 'impf', aspectPartner: 'reći', forms: ['govorim'] },
    { id: 'w_danas', hr: 'danas', de: ['heute'], pos: 'adv' },
  ], [
    { id: 's_vodu', hr: 'Danas pijem vodu.', de: 'Heute trinke ich Wasser.', cloze: 'w_voda' },
    { id: 's_govorim', hr: 'Govorim malo hrvatski.', de: 'Ich spreche ein bisschen Kroatisch.', cloze: 'w_govoriti' },
    { id: 's_zivim', hr: 'Živim u Njemačkoj.', de: 'Ich lebe in Deutschland.', cloze: 'w_zivjeti' },
  ]),
];

export const sampleContent = buildContent(sampleFiles, ['Splitu', 'Njemačkoj']);
