import type { LevelProgress } from '../../domain/stats';

/** Current CEFR level as the hero figure, with a meter towards the next level. */
export function LevelCard({ p }: { p: LevelProgress }) {
  const next = p.next;
  const pct = Math.round(p.toNext * 100);
  return (
    <section className="card level-card" aria-label="Aktuelles Niveau">
      <div className="level-top">
        <div>
          <div className="muted">Aktuelles Niveau</div>
          <div className="hero-figure">{p.current ?? 'Start'}</div>
        </div>
        <ol className="level-steps" aria-label="Niveaus">
          {p.levels.map((l) => (
            <li key={l.level} className={l.reached ? 'reached' : l.level === next?.level ? 'next' : ''}>
              {l.reached ? '✓ ' : ''}
              {l.level}
            </li>
          ))}
        </ol>
      </div>
      {next && next.hasContent ? (
        <>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Fortschritt bis ${next.level}`}>
            <div className="meter-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="level-sub">
            <span>
              <strong>{pct} %</strong> bis {next.level}
            </span>
            <span className="muted">
              {next.mastered} / {Math.ceil(next.words * 0.8)} Wörter für {next.level} beherrscht
            </span>
          </div>
        </>
      ) : next ? (
        <p className="muted" style={{ margin: 0 }}>
          Inhalte für {next.level} folgen bald.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Alle Niveaus erreicht. Čestitam!</p>
      )}
    </section>
  );
}
