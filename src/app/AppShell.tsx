import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { UpdatePrompt } from './UpdatePrompt';

export function AppShell() {
  return (
    <div className="shell">
      <main className="page">
        <Outlet />
      </main>
      <UpdatePrompt />
      <BottomNav />
    </div>
  );
}
