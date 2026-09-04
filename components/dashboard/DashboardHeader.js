'use client';

import { useState } from 'react';
import { Search, ChevronDown } from '@/components/icons/Icons';
import styles from './DashboardHeader.module.css';

const SPECIES_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'dog', label: 'Dogs' },
  { key: 'cat', label: 'Cats' },
];

function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) || options[0];

  return (
    <div className={styles['dash-dropdown']}>
      <button type="button" className={styles['dash-dropdown__trigger']} onClick={() => setOpen((v) => !v)}>
        {current.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className={styles['dash-dropdown__menu']} onMouseLeave={() => setOpen(false)}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles['dash-dropdown__item']}${o.key === value ? ` ${styles['dash-dropdown__item--active']}` : ''}`}
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
}) {
  return (
    <div className={styles['dash-header']}>
      <div className={styles['dash-header__row']}>
        <div className={styles['dash-header__greeting']}>
          <h1 className={styles['dash-header__title']}>Pets</h1>
          <p className={styles['dash-header__subtitle']}>
            {pets.length} registered
          </p>
        </div>
        <div className={styles['dash-header__search']}>
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pets"
          />
        </div>
      </div>

      <div className={styles['dash-header__row']}>
        <Dropdown value={filter} options={SPECIES_FILTERS} onChange={onFilterChange} />
      </div>
    </div>
  );
}
