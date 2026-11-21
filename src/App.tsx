import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { db } from './db/db';
import { syncCards } from './db/repo';
import { CardsScreen } from './features/cards/CardsScreen';
import { LearnHome } from './features/learn/LearnHome';
import { SessionScreen } from './features/learn/SessionScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { PronunciationScreen } from './features/pronunciation/PronunciationScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useTheme();

  useEffect(() => {
    syncCards(db)
      .then(() => setReady(true))
      .catch((e: unknown) => setError(String(e)));
    // Ask the browser not to evict our IndexedDB under storage pressure.
    void navigator.storage?.persist?.();
  }, []);

  if (error) return <div className="page"><h1 className="page-title">Fehler</h1><p>{error}</p></div>;
  if (!ready) return null;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/learn" replace />} />
          <Route path="/learn" element={<LearnHome />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/cards" element={<CardsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/pronunciation" element={<PronunciationScreen />} />
        </Route>
        <Route path="/session" element={<SessionScreen />} />
        <Route path="*" element={<Navigate to="/learn" replace />} />
      </Routes>
    </HashRouter>
  );
}
