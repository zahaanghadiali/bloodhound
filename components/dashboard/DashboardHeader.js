'use client';

import { useState } from 'react';
import { Search, Bell, Plus, ChevronDown } from '@/components/icons/Icons';

const SPECIES_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'dog', label: 'Dogs' },
  { key: 'cat', label: 'Cats' },
];

const SORTS = [
  { key: 'recent', label: 'Recently added' },
  { key: 'name', label: 'Name' },
];

function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) || options[0];

  return (
    <div className="dash-dropdown">
      <button type="button" className="dash-dropdown__trigger" onClick={() => setOpen((v) => !v)}>
        {current.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="dash-dropdown__menu" onMouseLeave={() => setOpen(false)}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`dash-dropdown__item${o.key === value ? ' dash-dropdown__item--active' : ''}`}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardHeader({
  pets,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  onAddPet,
}) {
  return (
    <div className="dash-header">
      <div className="dash-header__row">
        <div className="dash-header__greeting">
          <h1 className="dash-header__title">Pets</h1>
          <p className="dash-header__subtitle">
            {pets.length} registered
          </p>
        </div>
        <div className="dash-header__search">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pets"
          />
        </div>
        <button type="button" className="dash-header__icon-btn" title="Notifications" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <div className="dash-header__profile">
          <span className="dash-header__avatar">Z</span>
          <span>Zahaan</span>
          <ChevronDown size={11} />
        </div>
      </div>

      <div className="dash-header__row">
        <Dropdown value={filter} options={SPECIES_FILTERS} onChange={onFilterChange} />
        <Dropdown value={sort} options={SORTS} onChange={onSortChange} />
        <div style={{ flex: 1 }} />
        <button type="button" className="dash-header__cta" onClick={onAddPet}>
          <Plus size={14} />
          Add pet
        </button>
      </div>
    </div>
  );
}
