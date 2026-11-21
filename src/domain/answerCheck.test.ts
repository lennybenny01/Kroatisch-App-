import { describe, expect, it } from 'vitest';
import { checkAnswer, foldDiacritics, isAcceptable, levenshtein, normalize, suggestRating } from './answerCheck';
import { Rating } from './types';

const hr = (input: string, expected: string[], lemma?: string) => checkAnswer({ input, expected, lang: 'hr', lemma });
const de = (input: string, expected: string[]) => checkAnswer({ input, expected, lang: 'de' });

describe('normalize / fold', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalize('  Dobar   DAN! ')).toBe('dobar dan');
    expect(normalize('„Hvala“, lijepa.')).toBe('hvala lijepa');
  });
  it('folds Croatian diacritics', () => {
    expect(foldDiacritics('čćšžđ')).toBe('ccszd');
    expect(foldDiacritics('kuća')).toBe('kuca');
  });
  it('handles decomposed Unicode (č typed as c + combining caron)', () => {
    expect(hr('c\u030Caj', ['čaj']).verdict).toBe('correct');
  });
  it('levenshtein', () => {
    expect(levenshtein('kaffee', 'kafee')).toBe(1);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('Croatian answers (DE→HR, cloze)', () => {
  it('exact answer is correct', () => {
    expect(hr('čaj', ['čaj'])).toEqual({ verdict: 'correct', solution: 'čaj' });
    expect(hr('Doviđenja!', ['doviđenja']).verdict).toBe('correct');
  });

  it('“c” instead of “č” is almost right and returns the correct spelling', () => {
    expect(hr('caj', ['čaj'])).toEqual({ verdict: 'diacritics', solution: 'čaj' });
    expect(hr('kuca', ['kuća']).verdict).toBe('diacritics');
    expect(hr('secer', ['šećer']).verdict).toBe('diacritics');
    expect(hr('zivjeti', ['živjeti']).verdict).toBe('diacritics');
    expect(hr('dovidenja', ['doviđenja']).verdict).toBe('diacritics');
  });

  it('wrong diacritic (ć vs č) also counts as almost', () => {
    expect(hr('ćaj', ['čaj']).verdict).toBe('diacritics');
  });

  it('no typo tolerance – one letter is grammar in Croatian', () => {
    expect(hr('kave', ['kavu']).verdict).toBe('wrong');
    expect(hr('govorit', ['govoriti']).verdict).toBe('wrong');
  });

  it('cloze: dictionary form instead of the inflected form → "form"', () => {
    expect(hr('kava', ['kavu'], 'kava')).toEqual({ verdict: 'form', solution: 'kavu' });
    expect(hr('kuca', ['kuće'], 'kuća').verdict).toBe('form');
  });

  it('accepts alternative answers', () => {
    expect(hr('mama', ['majka', 'mama'])).toEqual({ verdict: 'correct', solution: 'mama' });
  });

  it('empty input is wrong', () => {
    expect(hr('   ', ['čaj']).verdict).toBe('wrong');
  });
});

describe('German answers (HR→DE)', () => {
  it('any accepted meaning is correct, case-insensitive', () => {
    expect(de('Tschüss', ['hallo', 'tschüss']).verdict).toBe('correct');
    expect(de('kaffee', ['Kaffee']).verdict).toBe('correct');
  });

  it('ignores German articles', () => {
    expect(de('der Kaffee', ['Kaffee']).verdict).toBe('correct');
    expect(de('die Rechnung', ['Rechnung']).verdict).toBe('correct');
  });

  it('tolerates small typos in longer words', () => {
    expect(de('Kafee', ['Kaffee'])).toEqual({ verdict: 'typo', solution: 'Kaffee' });
    expect(de('Schwster', ['Schwester']).verdict).toBe('typo');
  });

  it('no typo tolerance for very short words', () => {
    expect(de('Tea', ['Tee']).verdict).toBe('wrong');
    expect(de('nein', ['ja']).verdict).toBe('wrong');
  });

  it('missing umlauts count as diacritics', () => {
    expect(de('tschuss', ['tschüss']).verdict).toBe('diacritics');
  });

  it('bracketed parts are optional', () => {
    expect(de('freuen', ['(sich) freuen']).verdict).toBe('correct');
    expect(de('sich freuen', ['(sich) freuen']).verdict).toBe('correct');
  });

  it('several meanings separated by comma: all must be right', () => {
    expect(de('leben, wohnen', ['leben', 'wohnen']).verdict).toBe('correct');
    expect(de('leben, wohen', ['leben', 'wohnen']).verdict).toBe('typo');
    expect(de('leben, essen', ['leben', 'wohnen']).verdict).toBe('wrong');
  });

  it('clearly wrong answer', () => {
    expect(de('Wasser', ['Kaffee'])).toEqual({ verdict: 'wrong', solution: 'Kaffee' });
  });
});

describe('suggestRating', () => {
  it('maps verdicts to a suggested button', () => {
    expect(suggestRating('correct')).toBe(Rating.Good);
    expect(suggestRating('diacritics')).toBe(Rating.Hard);
    expect(suggestRating('typo')).toBe(Rating.Hard);
    expect(suggestRating('form')).toBe(Rating.Hard);
    expect(suggestRating('wrong')).toBe(Rating.Again);
  });
  it('strict diacritics mode treats missing háčeks as wrong', () => {
    expect(suggestRating('diacritics', true)).toBe(Rating.Again);
    expect(isAcceptable('diacritics', true)).toBe(false);
    expect(isAcceptable('diacritics', false)).toBe(true);
  });
});
