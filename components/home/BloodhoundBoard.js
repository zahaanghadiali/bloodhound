'use client';

import { Dog } from '@/components/icons/Icons';
import styles from './BloodhoundBoard.module.css';

const SAMPLE_PETS = [
  { id: 'pet-1', name: 'Max', breed: 'Golden Retriever', tag: 'DEA 1.1 Positive', last: 'Last donation: Jul 2026', rotate: -2 },
  { id: 'pet-2', name: 'Willow', breed: 'Domestic Shorthair', tag: 'Type A', last: 'Last donation: Jun 2026', rotate: 1.5 },
  { id: 'pet-3', name: 'Biscuit', breed: 'Holland Lop Rabbit', tag: 'Registered', last: 'Last donation: Aug 2026', rotate: -1 },
];

const EMPTY_SLOTS = [-2, 1.5, -1];

export default function BloodhoundBoard({ auth, onSignInClick }) {
  return (
    <div className={styles.board}>
      <h2 className={styles.board__title}>The Bloodhound Board</h2>
      <p className={styles.board__subtitle}>Every registered pet gets a spot on the board.</p>

      <div className={styles.board__frame}>
        <div className={styles.board__grid}>
          {auth
            ? SAMPLE_PETS.map((pet) => (
                <div key={pet.id} className={styles.board__card} style={{ transform: `rotate(${pet.rotate}deg)` }}>
                  <div className={styles.board__pin} />
                  <div className={styles.board__photo} aria-hidden="true">
                    <Dog size={30} />
                  </div>
                  <div className={styles.board__petName}>{pet.name}</div>
                  <div className={styles.board__petBreed}>{pet.breed}</div>
                  <div className={styles.board__petTag}>{pet.tag}</div>
                  <div className={styles.board__petLast}>{pet.last}</div>
                </div>
              ))
            : EMPTY_SLOTS.map((rotate, i) => (
                <div key={i} className={styles.board__empty} style={{ transform: `rotate(${rotate}deg)` }}>
                  <span className={styles.board__emptyIcon}>
                    <Dog size={22} />
                  </span>
                  <div className={styles.board__emptyLabel}>Your pet&apos;s spot</div>
                </div>
              ))}
        </div>
      </div>

      {!auth && (
        <div className={styles.board__gate}>
          <div className={styles.board__gateIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 10V7a5 5 0 0 0-10 0v3M5 10h14v10H5V10z"
                stroke="var(--bh-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className={styles.board__gateTitle}>Sign in to see your pets</h3>
          <p className={styles.board__gateBody}>Verify your phone number to view and manage your registered pets.</p>
          <button type="button" className={styles.board__gateCta} onClick={onSignInClick}>
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}
