'use client';

import { useState } from 'react';
import { PawPrint, LayoutGrid, Folder, Users, User, Phone } from '@/components/icons/Icons';
import styles from './Sidebar.module.css';

const SIGNED_OUT_ITEMS = [
  { key: 'chat', label: 'Chat', icon: PawPrint, brand: true },
  { key: 'home', label: 'Home', icon: LayoutGrid },
];

const SIGNED_IN_ITEMS = [
  { key: 'chat', label: 'Chat', icon: PawPrint, brand: true },
  { key: 'pets', label: 'Pets', icon: LayoutGrid },
  { key: 'requests', label: 'Requests', icon: Users },
  { key: 'files', label: 'Files', icon: Folder },
];

/**
 * Floating pill navigation docked to the bottom of the viewport, with an
 * account button that opens the sign-out menu or starts sign-in.
 * @param {{active: (string|undefined), onNavigate: function(string): void,
 *     auth: ?Object, onSignInClick: function(): void, onSignOut: function():
 *     void}} props Active tab key (defaults to 'chat'), the navigation handler,
 *     the signed-in account and the sign-in and sign-out handlers.
 * @return {JSX.Element} The navigation bar.
 */
export default function Sidebar({ active = 'chat', onNavigate, auth, onSignInClick, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const NAV_ITEMS = auth ? SIGNED_IN_ITEMS : SIGNED_OUT_ITEMS;

  /**
   * Toggles the account menu when signed in, or starts sign-in otherwise.
   */
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
          {brand ? <img className={styles['app-sidebar__logo']} src="/logo.png" alt="" /> : <Icon size={18} />}
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
