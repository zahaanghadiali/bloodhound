export default function OptionButtons({ options, onSelect, disabled }) {
  if (!options || options.length === 0) return null;

  return (
    <div className="options-row">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className="option-btn"
          disabled={disabled}
          onClick={() => onSelect(opt)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
