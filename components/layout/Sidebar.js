'use client';

import { PawPrint, LayoutGrid, Users, Settings } from '@/components/icons/Icons';

/**
 * Floating pill nav, docked to the bottom center of the viewport on every
 * breakpoint. The `chat` entry doubles as the brand mark and stays red.
 */
const NAV_ITEMS = [
  { key: 'chat', label: 'Chat', icon: PawPrint, brand: true },
  { key: 'pets', label: 'Pets', icon: LayoutGrid },
  { key: 'donors', label: 'Donors', icon: Users },
];

export default function Sidebar({ active = 'chat', onNavigate }) {
  return (
    <nav className="app-sidebar">
      {NAV_ITEMS.map(({ key, label, icon: Icon, brand }) => (
        <button
          key={key}
          type="button"
          className={`app-sidebar__item${brand ? ' app-sidebar__item--brand' : ''}${active === key ? ' app-sidebar__item--active' : ''}`}
          onClick={() => onNavigate?.(key)}
          title={label}
          aria-label={label}
        >
          <Icon size={brand ? 20 : 18} />
        </button>
      ))}
      <button type="button" className="app-sidebar__item" title="Settings" aria-label="Settings">
        <Settings size={18} />
      </button>
    </nav>
  );
}
