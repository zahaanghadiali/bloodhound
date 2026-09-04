import styles from './PawPrintsBackground.module.css';

const COUNT = 20;

// Deterministic pseudo-random (not Math.random) so server and client render
// the same markup — this tree re-renders during hydration since it's nested
// under a 'use client' ancestor.
function rand(seed, min, max, decimals) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const r = x - Math.floor(x);
  const v = min + r * (max - min);
  return Number(v.toFixed(decimals));
}

const TRAIL = Array.from({ length: COUNT }, (_, i) => ({
  left: rand(i * 3 + 1, 2, 94, 2),
  bottom: rand(i * 3 + 2, 2, 92, 2),
  size: rand(i * 3 + 3, 14, 36, 1),
  rotate: rand(i * 5 + 7, -35, 35, 1),
  delay: rand(i * 5 + 11, 0, 6.5, 2),
  duration: rand(i * 5 + 13, 5, 8.5, 2),
}));

function Paw({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="12" cy="15.4" rx="5.1" ry="4.3" />
      <circle cx="5.6" cy="10.6" r="2.15" />
      <circle cx="9.6" cy="6.6" r="2.25" />
      <circle cx="14.4" cy="6.6" r="2.25" />
      <circle cx="18.4" cy="10.6" r="2.15" />
    </svg>
  );
}

export default function PawPrintsBackground() {
  return (
    <div className={styles['paw-trail']} aria-hidden="true">
      {TRAIL.map((p, i) => (
        <div
          key={i}
          className={styles['paw-trail__print']}
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            '--r': `${p.rotate}deg`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          <Paw size={p.size} />
        </div>
      ))}
    </div>
  );
}
