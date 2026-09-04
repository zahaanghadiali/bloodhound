'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from '@/components/icons/Icons';
import DashboardHeader from './DashboardHeader';
import PetHealthCard from './PetHealthCard';
import PawPrintsBackground from './PawPrintsBackground';

export default function Dashboard({ onRequestBlood, onOpenFiles }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');

  useEffect(() => {
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
  }, []);

  const filteredPets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = pets.filter((pet) => {
      if (filter !== 'all' && pet.species !== filter) return false;
      if (q && !pet.name?.toLowerCase().includes(q) && !pet.breed?.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'name') {
      return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return [...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [pets, filter, sort, search]);

  return (
    <div className="dashboard">
      <PawPrintsBackground />

      <DashboardHeader
        pets={pets}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        onAddPet={onRequestBlood}
      />

      {error && <div className="chat-error">{error}</div>}

      {loading ? (
        <div className="dash-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="health-card health-card--skeleton" />
          ))}
        </div>
      ) : (
        <div className="dash-grid">
          {filteredPets.map((pet) => (
            <PetHealthCard key={pet._id} pet={pet} onOpenFiles={onOpenFiles} />
          ))}
          <button type="button" className="dash-add-tile" onClick={onRequestBlood}>
            <Plus size={26} />
            <span>Add another pet</span>
          </button>
        </div>
      )}
    </div>
  );
}
