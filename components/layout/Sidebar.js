'use client';

import { PawPrint, LayoutGrid, MessageCircle, Users, Settings } from '@/components/icons/Icons';

/**
 * Left navigation rail. `items` is a plain array so new pages can be added
 * here later without touching the shell layout.
 */
const NAV_ITEMS = [
  { key: 'pets', label: 'Pets', icon: LayoutGrid },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'donors', label: 'Donors', icon: Users },
];

export default function Sidebar({ active = 'pets', onNavigate }) {
  return (
    <nav className="app-sidebar">
      <div className="app-sidebar__brand">
        <PawPrint size={20} />
      </div>

      <div className="app-sidebar__nav">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`app-sidebar__item${active === key ? ' app-sidebar__item--active' : ''}`}
            onClick={() => onNavigate?.(key)}
            title={label}
            aria-label={label}
          >
            <Icon size={19} />
          </button>
        ))}
      </div>

      <div className="app-sidebar__footer">
        <button type="button" className="app-sidebar__item" title="Settings" aria-label="Settings">
          <Settings size={19} />
        </button>
      </div>
    </nav>
  );
}
