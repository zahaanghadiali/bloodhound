'use client';

import Hero from './Hero';
import HowItWorks from './HowItWorks';
import ImpactStats from './ImpactStats';
import BloodhoundBoard from './BloodhoundBoard';
import Faq from './Faq';
import LandingFooter from './LandingFooter';
import styles from './MarketingHome.module.css';

/**
 * The marketing/landing sections, factored out of HomeLanding so they can
 * also be reached as the "Home" tab of the mobile app shell (where chat,
 * not this, is the view people land on).
 */
export default function MarketingHome({ auth, onSignInClick }) {
  return (
    <div className={styles.marketing}>
      <Hero auth={auth} onSignInClick={onSignInClick} />
      <HowItWorks />
      <ImpactStats />
      <BloodhoundBoard auth={auth} onSignInClick={onSignInClick} />
      <Faq />
      <LandingFooter />
    </div>
  );
}
