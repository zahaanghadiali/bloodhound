'use client';

import { PawPrint, LayoutGrid, Users, Settings } from '@/components/icons/Icons';

/**
 * Left navigation rail (desktop) / bottom pill nav (mobile). `items` is a
 * plain array so new pages can be added here later without touching the
 * shell layout. The `chat` entry doubles as the brand logo and is rendered
 * larger since it's the default landing page and main entry point.
 */
const NAV_ITEMS = [
  { key: 'pets', label: 'Pets', icon: LayoutGrid },
  { key: 'chat', label: 'Chat', icon: PawPrint, brand: true },
  { key: 'donors', label: 'Donors', icon: Users },
];

export default function Sidebar({ active = 'chat', onNavigate }) {
  return (
    <nav className="app-sidebar">
      <div className="app-sidebar__nav">
        {NAV_ITEMS.map(({ key, label, icon: Icon, brand }) => (
          <button
            key={key}
            type="button"
            className={`app-sidebar__item${brand ? ' app-sidebar__item--brand' : ''}${active === key ? ' app-sidebar__item--active' : ''}`}
            onClick={() => onNavigate?.(key)}
            title={label}
            aria-label={label}
          >
            <Icon size={brand ? 22 : 19} />
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
