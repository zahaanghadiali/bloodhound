'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone } from '@/components/icons/Icons';
import DashboardHeader from './DashboardHeader';
import PetHealthCard from './PetHealthCard';
import PawPrintsBackground from './PawPrintsBackground';
import styles from './Dashboard.module.css';

const POLL_INTERVAL_MS = 5000;

/** Shallow-compares two pet lists by id + updatedAt so polling doesn't force
 * a re-render (and re-sort/re-filter) when nothing actually changed. */
function petsChanged(prev, next) {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]._id !== next[i]._id || prev[i].updatedAt !== next[i].updatedAt) return true;
  }
  return false;
}

export default function Dashboard({ auth, onSignInClick, onOpenFiles }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchPets = useCallback(async (ownerId, { signal } = {}) => {
    const res = await fetch(`/api/pets?owner=${ownerId}`, { signal });
    if (!res.ok) throw new Error('Failed to load pets');
    const data = await res.json();
    return data.pets || [];
  }, []);

  useEffect(() => {
    if (!auth?.parentId) {
      setPets([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let timer;
    const controller = new AbortController();

    const tick = async (isInitial) => {
      if (isInitial) setLoading(true);
      try {
        const nextPets = await fetchPets(auth.parentId, { signal: controller.signal });
        if (cancelled) return;
        setError(null);
        setPets((prev) => (petsChanged(prev, nextPets) ? nextPets : prev));
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    const scheduleNext = () => {
      timer = setTimeout(async () => {
        // Skip polling while the tab is in the background — resumes as soon
        // as it's visible again instead of piling up missed ticks.
        if (document.visibilityState === 'visible') await tick(false);
        if (!cancelled) scheduleNext();
      }, POLL_INTERVAL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    tick(true).then(() => {
      if (!cancelled) scheduleNext();
    });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [auth, fetchPets]);

  const filteredPets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pets
      .filter((pet) => {
        if (filter !== 'all' && pet.species !== filter) return false;
        if (q && !pet.name?.toLowerCase().includes(q) && !pet.breed?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [pets, filter, search]);

  if (!auth) {
    return (
      <div className={styles.dashboard}>
        <PawPrintsBackground />
        <div className={styles['dash-signin-gate']}>
          <span className={styles['dash-signin-gate__icon']}>
            <Phone size={22} />
          </span>
          <h2 className={styles['dash-signin-gate__title']}>Sign in to see your pets</h2>
          <p className={styles['dash-signin-gate__subtitle']}>Verify your phone number to view and manage your registered pets.</p>
          <button type="button" className="chip-btn chip-btn--primary" onClick={onSignInClick}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <PawPrintsBackground />

      <DashboardHeader
        pets={pets}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
      />

      {error && <div className="chat-error">{error}</div>}

      {loading ? (
        <div className={styles['dash-grid']}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles['health-card--skeleton']} />
          ))}
        </div>
      ) : filteredPets.length === 0 ? (
        <div className={styles['dash-empty']}>
          <p>No pets registered yet.</p>
          <p>Say hello to the bot to add your first one. 🐾</p>
        </div>
      ) : (
        <div className={styles['dash-grid']}>
          {filteredPets.map((pet) => (
            <PetHealthCard key={pet._id} pet={pet} onOpenFiles={onOpenFiles} />
          ))}
        </div>
      )}
    </div>
  );
}
