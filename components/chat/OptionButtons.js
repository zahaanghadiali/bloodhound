import styles from './OptionButtons.module.css';

export default function OptionButtons({ options, onSelect, disabled }) {
  if (!options || options.length === 0) return null;

  return (
    <div className={styles['options-row']}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={styles['option-btn']}
          disabled={disabled}
          onClick={() => onSelect(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
