'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatApp from '@/components/chat/ChatApp';
import AuthPage from '@/components/auth/AuthPage';
import AppShell from '@/components/layout/AppShell';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import ImpactStats from './ImpactStats';
import BloodhoundBoard from './BloodhoundBoard';
import Faq from './Faq';
import LandingFooter from './LandingFooter';
import { getAuth } from '@/components/auth/lib/auth';
import styles from './HomeLanding.module.css';

const MOBILE_QUERY = '(max-width: 1080px)';

/**
 * React hook that tracks whether the viewport is at or below the mobile
 * breakpoint.
 * @return {boolean} True on a mobile-width viewport; false until mounted.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    /**
     * Updates the mobile flag when the media query result changes.
     * @param {MediaQueryListEvent} e Media query change event.
     */
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * Landing page: the app shell on mobile, and on larger screens the marketing
 * sections (or sign-in) beside a chat dock.
 * @return {JSX.Element} The landing page.
 */
export default function HomeLanding() {
  const router = useRouter();
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  if (isMobile) return <AppShell />;

  return (
    <div className={styles.home}>
      <div className={styles.home__stage}>
        {showSignIn ? (
          <AuthPage
            onBack={() => setShowSignIn(false)}
            onSuccess={() => {
              setAuthState(getAuth());
              router.push('/dashboard');
            }}
          />
        ) : (
          <>
            <Hero auth={auth} onSignInClick={() => setShowSignIn(true)} />
            <HowItWorks />
            <ImpactStats />
            <BloodhoundBoard auth={auth} onSignInClick={() => setShowSignIn(true)} />
            <Faq />
            <LandingFooter />
          </>
        )}
      </div>

      <aside className={styles.home__chatDock}>
        <ChatApp />
      </aside>
    </div>
  );
}
