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

// Matches the breakpoint AppShell/Sidebar collapse to a single-pane,
// pill-nav layout at. Below it, the chat-first app shell IS the home page;
// at or above it, home stays the marketing scroll page with a chat dock.
const MOBILE_QUERY = '(max-width: 1080px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

export default function HomeLanding() {
  const router = useRouter();
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  // On mobile, the app shell (chat-first, with the pill nav reaching the
  // marketing "Home" tab, sign-up, and — once signed in — the dashboard,
  // files and requests tabs) IS the home page.
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
