import { Component, type ReactNode } from 'react';

/** Last line of defence: an understandable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" role="alert">
        <h1 className="page-title">Ups – da ist etwas schiefgelaufen</h1>
        <p>Dein Lernfortschritt ist sicher gespeichert. Lade die App neu, um weiterzumachen.</p>
        <p className="muted small">{this.state.error.message}</p>
        <button className="btn btn-primary btn-block" onClick={() => location.reload()}>
          Neu laden
        </button>
      </div>
    );
  }
}
