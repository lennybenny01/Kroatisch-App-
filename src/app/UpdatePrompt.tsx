import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows a hint when a new app version has been downloaded in the background. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates every hour while the app is open.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span style={{ flex: 1 }}>Neue Version verfügbar</span>
      <button className="btn btn-ghost" style={{ color: 'inherit' }} onClick={() => setNeedRefresh(false)}>
        Später
      </button>
      <button className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
        Aktualisieren
      </button>
    </div>
  );
}
