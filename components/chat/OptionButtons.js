import styles from './OptionButtons.module.css';

/**
 * Row of quick-reply buttons under a bot message.
 * @param {{options: ?Array<{value: *, label: string}>, onSelect:
 *     function(Object): void, disabled: boolean}} props Options to show and the
 *     tap handler.
 * @return {?JSX.Element} The buttons, or null when there are no options.
 */
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
