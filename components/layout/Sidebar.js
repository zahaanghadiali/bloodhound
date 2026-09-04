'use client';

import { useState } from 'react';
import { PawPrint, LayoutGrid, Folder, User, Phone } from '@/components/icons/Icons';
import styles from './Sidebar.module.css';

/**
 * Floating pill nav, docked to the bottom center of the viewport on every
 * breakpoint. The `chat` entry doubles as the brand mark and stays red.
 * Only entries that actually navigate somewhere belong here.
 */
const NAV_ITEMS = [
  { key: 'chat', label: 'Chat', icon: PawPrint, brand: true },
  { key: 'pets', label: 'Pets', icon: LayoutGrid },
  { key: 'files', label: 'Files', icon: Folder },
];

export default function Sidebar({ active = 'chat', onNavigate, auth, onSignInClick, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAccountClick = () => {
    if (auth) {
      setMenuOpen((v) => !v);
    } else {
      onSignInClick?.();
    }
  };

  return (
    <nav className={styles['app-sidebar']}>
      {NAV_ITEMS.map(({ key, label, icon: Icon, brand }) => (
        <button
          key={key}
          type="button"
          className={`${styles['app-sidebar__item']}${brand ? ` ${styles['app-sidebar__item--brand']}` : ''}${active === key ? ` ${styles['app-sidebar__item--active']}` : ''}`}
          onClick={() => onNavigate?.(key)}
          title={label}
          aria-label={label}
        >
          <Icon size={brand ? 20 : 18} />
        </button>
      ))}

      <button
        type="button"
        className={`${styles['app-sidebar__item']}${menuOpen ? ` ${styles['app-sidebar__item--active']}` : ''}`}
        onClick={handleAccountClick}
        title={auth ? 'Account' : 'Sign in'}
        aria-label={auth ? 'Account' : 'Sign in'}
      >
        <User size={18} />
      </button>

      {menuOpen && auth && (
        <>
          <div className={styles['account-menu-backdrop']} onClick={() => setMenuOpen(false)} />
          <div className={`${styles['account-menu']} glass`}>
            <div className={styles['account-menu__row']}>
              <span className={styles['account-menu__icon']}>
                <Phone size={14} />
              </span>
              <span className={styles['account-menu__phone']}>{auth.phone}</span>
            </div>
            <button
              type="button"
              className={styles['account-menu__signout']}
              onClick={() => {
                setMenuOpen(false);
                onSignOut?.();
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
