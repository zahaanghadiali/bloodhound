'use client';

import LandingHeader from './LandingHeader';
import styles from './Hero.module.css';

export default function Hero({ auth, onSignInClick }) {
  return (
    <div className={styles.hero}>
      <div className={styles.hero__content}>
        <LandingHeader auth={auth} onSignInClick={onSignInClick} />

        <div className={styles.hero__copy}>
          <div className={styles.hero__eyebrow}>A neighborhood pet blood drive</div>
          <h1 className={styles.hero__title}>Every drop counts for pets who can&apos;t ask twice.</h1>
          <p className={styles.hero__subtitle}>
            Bloodhound connects your dog, cat, rabbit, or bird with pets in urgent need nearby — a quick vet visit
            that turns your good boy (or bunny) into a lifesaver.
          </p>
          {!auth && (
            <button type="button" className={styles.hero__cta} onClick={onSignInClick}>
              Register your pet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
