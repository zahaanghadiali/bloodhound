import styles from './ImpactStats.module.css';

const STATS = [
  { value: '2,480', label: 'pets registered' },
  { value: '940', label: 'lives saved' },
  { value: '3,200+', label: 'happy tails wagged' },
];

export default function ImpactStats() {
  return (
    <div id="impact" className={styles.impact}>
      <h2 className={styles.impact__title}>Our impact so far</h2>
      <div className={styles.impact__grid}>
        {STATS.map((stat) => (
          <div key={stat.label} className={styles.impact__card}>
            <div className={styles.impact__value}>{stat.value}</div>
            <div className={styles.impact__label}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
