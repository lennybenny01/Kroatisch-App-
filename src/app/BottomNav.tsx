import { NavLink } from 'react-router-dom';
import { IconCards, IconLearn, IconProgress, IconSettings } from './icons';

const items = [
  { to: '/learn', label: 'Lernen', Icon: IconLearn },
  { to: '/progress', label: 'Fortschritt', Icon: IconProgress },
  { to: '/cards', label: 'Karten', Icon: IconCards },
  { to: '/settings', label: 'Einstellungen', Icon: IconSettings },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
