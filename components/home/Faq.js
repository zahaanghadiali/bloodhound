import styles from './Faq.module.css';

const QA = [
  {
    q: 'Is donating blood safe for my pet?',
    a: 'Yes — a licensed vet monitors the whole visit, and only pets who pass a quick health check are asked to donate.',
  },
  {
    q: 'How often can my pet donate?',
    a: 'Dogs about every 3 months, cats every 2 months, and rabbits or birds on a schedule your vet sets based on size and health.',
  },
  {
    q: 'Which pets can take part?',
    a: 'Most healthy dogs, cats, rabbits, and birds over a year old — your vet confirms eligibility at registration.',
  },
  {
    q: 'Does it cost anything?',
    a: "Never. It's free for you, and many partner clinics throw in a complimentary wellness check as a thank-you.",
  },
];

export default function Faq() {
  return (
    <div id="faq" className={styles.faq}>
      <h2 className={styles.faq__title}>Frequently asked questions</h2>
      <div className={styles.faq__list}>
        {QA.map((item) => (
          <div key={item.q} className={styles.faq__item}>
            <div className={styles.faq__q}>{item.q}</div>
            <div className={styles.faq__a}>{item.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
