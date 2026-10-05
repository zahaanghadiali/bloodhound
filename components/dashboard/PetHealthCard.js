import { Dog, Cat } from '@/components/icons/Icons';
import styles from './PetHealthCard.module.css';

/**
 * Formats a pet's age from its date of birth.
 * @param {?(string|Date)} dob Date of birth.
 * @return {?string} Age in months (e.g. "8mo") under a year and in years (e.g.
 *     "3y") otherwise, or null if the date of birth is unknown.
 */
function ageLabel(dob) {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return `${Math.max(1, Math.round(years * 12))}mo`;
  return `${Math.floor(years)}y`;
}

/**
 * Maps a pet's donor status to the status pill's style variant.
 * @param {{donorStatus: string}} pet Pet to describe.
 * @return {string} 'paused', 'deleted' or 'active'.
 */
function statusFor(pet) {
  if (pet.donorStatus === 'paused') return 'paused';
  if (pet.donorStatus === 'deleted') return 'deleted';
  return 'active';
}

/**
 * Picks the text shown in a pet's status pill.
 * @param {{donorStatus: string, bloodType: (Object|undefined)}} pet Pet to
 *     describe.
 * @return {string} 'Paused', 'Removed', 'Eligible' (known blood type) or
 *     'Active'.
 */
function statusLabel(pet) {
  if (pet.donorStatus === 'paused') return 'Paused';
  if (pet.donorStatus === 'deleted') return 'Removed';
  return pet.bloodType?.known ? 'Eligible' : 'Active';
}

/**
 * Card summarizing one pet: photo, breed, age, donor status, blood type,
 * vaccination and location. Clicking it opens the pet's files.
 * @param {{pet: Object, onOpenFiles: (function(string): void|undefined)}} props
 *     Pet to show and the handler that receives its id.
 * @return {JSX.Element} The card.
 */
export default function PetHealthCard({ pet, onOpenFiles }) {
  const Icon = pet.species === 'cat' ? Cat : Dog;
  const age = ageLabel(pet.dob);

  return (
    <div
      className={`${styles['health-card']} ${styles['health-card--clickable']}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpenFiles?.(pet._id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenFiles?.(pet._id);
        }
      }}
    >
      <div className={styles['health-card__top']}>
        <span className={`${styles['health-card__avatar']} ${styles[`health-card__avatar--${pet.species}`]}`}>
          {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : <Icon size={21} />}
        </span>
        <div className={styles['health-card__body']}>
          <h3 className={styles['health-card__name']}>{pet.name || 'Unnamed'}</h3>
          <p className={styles['health-card__meta']}>
            {pet.breed || 'Mixed breed'}
            {pet.sex ? ` · ${pet.sex}` : ''}
            {age ? ` · ${age}` : ''}
          </p>
        </div>
        <span className={`status-pill status-pill--${statusFor(pet)}`}>{statusLabel(pet)}</span>
      </div>

      <div className={styles['health-card__stats']}>
        <div className={`${styles['health-card__stat']}${pet.bloodType?.known ? ` ${styles['health-card__stat--blood']}` : ''}`}>
          {pet.bloodType?.known ? pet.bloodType.value : 'Unknown'}
        </div>
        <div className={styles['health-card__stat']}>{pet.vaccinated ? 'Vaccinated' : 'Not vaccinated'}</div>
      </div>

      <div className={styles['health-card__location']}>{pet.locationText || 'Location unknown'}</div>
    </div>
  );
}
