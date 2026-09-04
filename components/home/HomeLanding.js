'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatApp from '@/components/chat/ChatApp';
import AuthPage from '@/components/auth/AuthPage';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import ImpactStats from './ImpactStats';
import BloodhoundBoard from './BloodhoundBoard';
import Faq from './Faq';
import LandingFooter from './LandingFooter';
import { getAuth } from '@/components/auth/lib/auth';
import styles from './HomeLanding.module.css';

export default function HomeLanding() {
  const router = useRouter();
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

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
