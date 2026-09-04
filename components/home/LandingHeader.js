'use client';

import Link from 'next/link';
import { Dog } from '@/components/icons/Icons';
import styles from './LandingHeader.module.css';

export default function LandingHeader({ auth, onSignInClick }) {
  return (
    <div className={styles.header}>
      <div className={styles.header__brand}>
        <span className={styles.header__mark}>
          <Dog size={17} />
        </span>
        <span className={styles.header__name}>Bloodhound</span>
      </div>

      <nav className={styles.header__nav}>
        <a href="#how">How it works</a>
        <a href="#impact">Impact</a>
        <a href="#faq">FAQ</a>
      </nav>

      {auth ? (
        <Link href="/dashboard" className={styles.header__user}>
          <span className={styles.header__avatar}>{(auth.name || '?').charAt(0).toUpperCase()}</span>
          <span className={styles.header__greeting}>Hi, {auth.name ? auth.name.split(' ')[0] : 'there'}</span>
        </Link>
      ) : (
        <button type="button" className={styles.header__signIn} onClick={onSignInClick}>
          Sign in
        </button>
      )}
    </div>
  );
}
