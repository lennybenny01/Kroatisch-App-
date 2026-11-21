import { Link, Outlet, useLocation } from 'react-router-dom';
import { IconPronunciation } from './icons';
import { BottomNav } from './BottomNav';
import { UpdatePrompt } from './UpdatePrompt';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="shell">
      {pathname !== '/pronunciation' && (
        <Link to="/pronunciation" className="pron-fab" aria-label="Aussprache nachschlagen" title="Aussprache">
          <IconPronunciation />
        </Link>
      )}
      <main className="page">
        <Outlet />
      </main>
      <UpdatePrompt />
      <BottomNav />
    </div>
  );
}
