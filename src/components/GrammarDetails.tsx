import type { GrammarTopic } from '../domain/types';

/** Collapsible grammar explanation. */
export function GrammarDetails({ topic, open = false }: { topic: GrammarTopic; open?: boolean }) {
  return (
    <details className="grammar" open={open}>
      <summary>
        <span className="grammar-icon" aria-hidden>
          §
        </span>
        <span className="grammar-head">
          <strong>{topic.title}</strong>
          <span className="muted">{topic.summary}</span>
        </span>
      </summary>
      <div className="grammar-body">
        {topic.body?.map((p, i) => <p key={i}>{p}</p>)}
        {topic.table && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {topic.table.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topic.table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {topic.examples && (
          <ul className="grammar-examples">
            {topic.examples.map((e) => (
              <li key={e.hr}>
                <span lang="hr">{e.hr}</span>
                <span className="muted"> – {e.de}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
