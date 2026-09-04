import styles from './HowItWorks.module.css';

const STEPS = [
  {
    n: 1,
    title: 'Register your pet',
    body: "Tell us about your pup, kitty, or bunny — breed, age, and blood type if you know it.",
  },
  {
    n: 2,
    title: 'We find a match',
    body: 'When a nearby pet needs blood, we match by type, size, and distance to your vet.',
  },
  {
    n: 3,
    title: 'Donate & celebrate',
    body: 'A quick, supervised vet visit, a treat, and your pet just saved a life.',
  },
];

export default function HowItWorks() {
  return (
    <div id="how" className={styles.how}>
      <h2 className={styles.how__title}>How it works</h2>
      <p className={styles.how__subtitle}>Three easy steps between your pet and their next tail-wagging good deed.</p>

      <div className={styles.how__grid}>
        {STEPS.map((step) => (
          <div key={step.n} className={styles.how__card}>
            <div className={styles.how__num}>{step.n}</div>
            <h3 className={styles.how__cardTitle}>{step.title}</h3>
            <p className={styles.how__cardBody}>{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
