'use client';

import { useEffect, useMemo, useState } from 'react';
import { Phone } from '@/components/icons/Icons';
import DashboardHeader from './DashboardHeader';
import PetHealthCard from './PetHealthCard';
import PawPrintsBackground from './PawPrintsBackground';
import styles from './Dashboard.module.css';

export default function Dashboard({ auth, onSignInClick, onOpenFiles }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!auth) {
      setPets([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetch('/api/pets')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load pets');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPets(data.pets || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

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
