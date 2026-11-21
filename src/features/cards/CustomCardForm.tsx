import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconBack } from '../../app/icons';
import { content } from '../../content';
import { db } from '../../db/db';
import { createCustomWord, deleteCustomWord, updateCustomWord, type CustomWordInput } from '../../db/repo';
import { foldDiacritics, normalize } from '../../domain/answerCheck';
import type { PartOfSpeech } from '../../domain/types';
import { DiacriticsBar } from '../learn/DiacriticsBar';

const POS: { value: PartOfSpeech; label: string }[] = [
  { value: 'noun', label: 'Nomen' },
  { value: 'verb', label: 'Verb' },
  { value: 'adj', label: 'Adjektiv' },
  { value: 'adv', label: 'Adverb' },
  { value: 'phrase', label: 'Redewendung' },
  { value: 'other', label: 'Sonstiges' },
];

const splitMeanings = (s: string) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);

/** Create or edit an own card. */
export function CustomCardForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(() => (id ? db.customWords.get(id) : undefined), [id]);
  const [hr, setHr] = useState('');
  const [de, setDe] = useState('');
  const [pos, setPos] = useState<PartOfSpeech>('noun');
  const [gender, setGender] = useState<'m' | 'f' | 'n' | ''>('');
  const [exHr, setExHr] = useState('');
  const [exDe, setExDe] = useState('');
  const [notes, setNotes] = useState('');
  const [produce, setProduce] = useState(true);
  const [error, setError] = useState<string>();
  const [focused, setFocused] = useState<'hr' | 'ex' | undefined>();
  const hrRef = useRef<HTMLInputElement>(null);
  const exRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!existing) return;
    setHr([existing.hr, ...(existing.hrAlt ?? [])].join('; '));
    setDe(existing.de.join('; '));
    setPos(existing.pos);
    setGender(existing.gender ?? '');
    setExHr(existing.example?.hr ?? '');
    setExDe(existing.example?.de ?? '');
    setNotes(existing.notes ?? '');
    setProduce(existing.practiceProduce);
  }, [existing]);

  // Already in the course?
  const first = splitMeanings(hr)[0] ?? '';
  const dup = first ? content.words.find((w) => foldDiacritics(normalize(w.hr)) === foldDiacritics(normalize(first))) : undefined;

  const save = async () => {
    setError(undefined);
    const [main, ...alts] = splitMeanings(hr);
    const input: CustomWordInput = {
      hr: main ?? '',
      hrAlt: alts,
      de: splitMeanings(de),
      pos,
      gender: pos === 'noun' && gender ? gender : undefined,
      notes,
      example: exHr.trim() ? { hr: exHr, de: exDe } : undefined,
      practiceProduce: produce,
    };
    try {
      if (id) await updateCustomWord(db, id, input);
      else await createCustomWord(db, input);
      navigate('/cards?unit=custom');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Zurück">
          <IconBack />
        </button>
        <h1 className="page-title">{id ? 'Karte bearbeiten' : 'Eigene Karte'}</h1>
      </div>

      <div className="card form">
        <label className="field">
          <span className="field-label">Kroatisch *</span>
          <input
            ref={hrRef}
            className="text-input"
            value={hr}
            onChange={(e) => setHr(e.target.value)}
            onFocus={() => setFocused('hr')}
            lang="hr"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="z. B. sladoled"
          />
          <span className="field-hint">Weitere richtige Antworten mit „;“ trennen.</span>
        </label>
        {focused === 'hr' && <DiacriticsBar inputRef={hrRef} onInsert={setHr} />}
        {dup && !id && (
          <div className="feedback almost">
            <div className="feedback-body">
              „{dup.hr}“ gibt es schon im Kurs ({content.unitById.get(dup.unitId)?.title}). Du kannst die Karte trotzdem anlegen.
            </div>
          </div>
        )}
        <label className="field">
          <span className="field-label">Deutsch *</span>
          <input className="text-input" value={de} onChange={(e) => setDe(e.target.value)} onFocus={() => setFocused(undefined)} placeholder="z. B. Eis; Speiseeis" />
          <span className="field-hint">Mehrere Bedeutungen mit „;“ trennen.</span>
        </label>
        <div className="field">
          <span className="field-label">Wortart</span>
          <div className="chips wrap" role="group" aria-label="Wortart">
            {POS.map((p) => (
              <button key={p.value} type="button" aria-pressed={pos === p.value} onClick={() => setPos(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {pos === 'noun' && (
          <div className="field">
            <span className="field-label">Genus</span>
            <div className="segmented" role="group" aria-label="Genus">
              {(['m', 'f', 'n'] as const).map((g) => (
                <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(gender === g ? '' : g)}>
                  {g === 'm' ? 'maskulin' : g === 'f' ? 'feminin' : 'neutrum'}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field">
          <span className="field-label">Beispielsatz (Kroatisch)</span>
          <input ref={exRef} className="text-input" value={exHr} onChange={(e) => setExHr(e.target.value)} onFocus={() => setFocused('ex')} lang="hr" placeholder="z. B. Volim sladoled." />
        </label>
        {focused === 'ex' && <DiacriticsBar inputRef={exRef} onInsert={setExHr} />}
        {exHr.trim() && (
          <label className="field">
            <span className="field-label">Beispielsatz (Deutsch)</span>
            <input className="text-input" value={exDe} onChange={(e) => setExDe(e.target.value)} onFocus={() => setFocused(undefined)} placeholder="z. B. Ich mag Eis." />
          </label>
        )}
        <label className="field">
          <span className="field-label">Notiz</span>
          <input className="text-input" value={notes} onChange={(e) => setNotes(e.target.value)} onFocus={() => setFocused(undefined)} placeholder="z. B. gehört bei Oma in Split" />
        </label>
        <label className="switch-row">
          <span>
            <strong>Auch Deutsch → Kroatisch üben</strong>
            <span className="muted small"> – kommt, sobald Kroatisch → Deutsch sitzt</span>
          </span>
          <input type="checkbox" className="switch" checked={produce} onChange={(e) => setProduce(e.target.checked)} />
        </label>
        {error && (
          <div className="feedback bad" role="alert">
            <div className="feedback-title">{error}</div>
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={() => void save()}>
          {id ? 'Speichern' : 'Karte anlegen'}
        </button>
        {id && (
          <button
            className="btn btn-block"
            style={{ color: 'var(--bad)' }}
            onClick={async () => {
              if (confirm('Diese Karte und ihren Lernstand löschen?')) {
                await deleteCustomWord(db, id);
                navigate('/cards?unit=custom');
              }
            }}
          >
            Karte löschen
          </button>
        )}
      </div>
    </>
  );
}
