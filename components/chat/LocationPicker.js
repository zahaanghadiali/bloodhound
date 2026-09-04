'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from '@/components/icons/Icons';
import { fetchCountries, searchCities } from '@/components/chat/lib/geoApi';
import styles from './LocationPicker.module.css';

export default function LocationPicker({ onSelect, onShareCurrent, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (expanded && countries.length === 0) {
      fetchCountries()
        .then(setCountries)
        .catch(() => setCountries([]));
    }
  }, [expanded, countries.length]);

  useEffect(() => {
    if (!countryCode) {
      setCityResults([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchCities(countryCode, cityQuery)
        .then(setCityResults)
        .catch(() => setCityResults([]));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [countryCode, cityQuery]);

  const countryName = countries.find((c) => c.code === countryCode)?.name || '';

  const handlePickCity = (city) => {
    onSelect({ lat: city.lat, lng: city.lng, label: `${city.name}, ${countryName}` });
    setExpanded(false);
    setCityQuery('');
    setCityResults([]);
  };

  return (
    <div className={styles['location-picker']}>
      <div className={styles['location-picker__actions']}>
        <button
          type="button"
          className="chip-btn chip-btn--primary"
          onClick={onShareCurrent}
          disabled={disabled}
        >
          <MapPin size={16} />
          Share my current location
        </button>
        <button type="button" className="chip-btn" onClick={() => setExpanded((v) => !v)} disabled={disabled}>
          Or choose manually
        </button>
      </div>

      {expanded && (
        <div className={styles['location-picker__manual']}>
          <select
            className={styles['location-picker__select']}
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setCityQuery('');
              setCityResults([]);
            }}
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          {countryCode && (
            <div className={styles['location-picker__city']}>
              <input
                type="text"
                className={styles['location-picker__input']}
                placeholder="Search city…"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
              />
              {cityResults.length > 0 && (
                <ul className={styles['location-picker__results']}>
                  {cityResults.map((city) => (
                    <li key={city.id}>
                      <button type="button" onClick={() => handlePickCity(city)}>
                        {city.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
