'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dog, Cat, Droplet, Syringe, MapPin, PawPrint } from '@/components/icons/Icons';

const SPECIES_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'dog', label: 'Dogs' },
  { key: 'cat', label: 'Cats' },
];

function ageFromDob(dob) {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return `${Math.max(1, Math.round(years * 12))}mo`;
  return `${Math.floor(years)}y`;
}

function SpeciesIcon({ species, photoUrl }) {
  if (photoUrl) {
    return (
      <span className="pet-card__avatar pet-card__avatar--photo">
        <img src={photoUrl} alt="" />
      </span>
    );
  }
  const Icon = species === 'cat' ? Cat : Dog;
  return (
    <span className={`pet-card__avatar pet-card__avatar--${species}`}>
      <Icon size={22} />
    </span>
  );
}

function StatusPill({ status }) {
  return <span className={`status-pill status-pill--${status}`}>{status}</span>;
}

export default function PetsDashboard() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

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

  const filteredPets = useMemo(
    () => (filter === 'all' ? pets : pets.filter((p) => p.species === filter)),
    [pets, filter]
  );

  return (
    <div className="pets-dashboard">
      <div className="pets-dashboard__header">
        <div>
          <h1 className="pets-dashboard__title">Registered Pets</h1>
          <p className="pets-dashboard__subtitle">
            {loading ? 'Loading…' : `${filteredPets.length} of ${pets.length} pets`}
          </p>
        </div>
        <div className="filter-row">
          {SPECIES_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`filter-pill${filter === f.key ? ' filter-pill--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      {loading ? (
        <div className="pets-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pet-card pet-card--skeleton glass" />
          ))}
        </div>
      ) : filteredPets.length === 0 ? (
        <div className="pets-empty glass">
          <PawPrint size={28} />
          <p>No pets registered yet.</p>
        </div>
      ) : (
        <div className="pets-grid">
          {filteredPets.map((pet) => (
            <div key={pet._id} className="pet-card glass">
              <div className="pet-card__top">
                <SpeciesIcon species={pet.species} photoUrl={pet.photoUrl} />
                <StatusPill status={pet.donorStatus} />
              </div>

              <div className="pet-card__body">
                <h3 className="pet-card__name">{pet.name || 'Unnamed'}</h3>
                <p className="pet-card__meta">
                  {pet.breed || 'Mixed breed'}
                  {pet.sex ? ` · ${pet.sex}` : ''}
                  {ageFromDob(pet.dob) ? ` · ${ageFromDob(pet.dob)}` : ''}
                </p>
              </div>

              <div className="pet-card__badges">
                <span className={`badge${pet.bloodType?.known ? ' badge--filled' : ''}`}>
                  <Droplet size={13} />
                  {pet.bloodType?.known ? pet.bloodType.value : 'Blood type unknown'}
                </span>
                <span className={`badge${pet.vaccinated ? ' badge--filled' : ''}`}>
                  <Syringe size={13} />
                  {pet.vaccinated ? 'Vaccinated' : 'Not vaccinated'}
                </span>
              </div>

              <div className="pet-card__owner">
                <MapPin size={13} />
                <span>
                  {pet.owner?.name || 'Unknown owner'}
                  {pet.locationText ? ` · ${pet.locationText}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
