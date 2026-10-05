'use client';

import Hero from './Hero';
import HowItWorks from './HowItWorks';
import ImpactStats from './ImpactStats';
import BloodhoundBoard from './BloodhoundBoard';
import Faq from './Faq';
import LandingFooter from './LandingFooter';
import styles from './MarketingHome.module.css';

/**
 * The marketing sections of the landing page, also shown as the "Home" tab of
 * the mobile app shell.
 * @param {{auth: ?Object, onSignInClick: function(): void}} props Signed-in
 *     account and the sign-in handler.
 * @return {JSX.Element} The marketing sections.
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
