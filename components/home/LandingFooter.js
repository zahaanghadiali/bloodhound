import styles from './LandingFooter.module.css';

export default function LandingFooter() {
  return (
    <div className={styles.footer}>
      <img className={styles.footer__mark} src="/logo.png" alt="" />
      Bloodhound — every drop counts.
    </div>
  );
}
