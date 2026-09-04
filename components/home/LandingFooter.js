import { Dog } from '@/components/icons/Icons';
import styles from './LandingFooter.module.css';

export default function LandingFooter() {
  return (
    <div className={styles.footer}>
      <span className={styles.footer__mark}>
        <Dog size={12} />
      </span>
      Bloodhound — every drop counts.
    </div>
  );
}
