'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import FilesPage from '@/components/files/FilesPage';
import RequestsPage from '@/components/requests/RequestsPage';
import ChatApp from '@/components/chat/ChatApp';
import AuthPage from '@/components/auth/AuthPage';
import MarketingHome from '@/components/home/MarketingHome';
import { getAuth, clearAuth } from '@/components/auth/lib/auth';
import { resetExternalUserId } from '@/components/chat/lib/session';
import styles from './AppShell.module.css';

/**
 * Top-level signed-in layout: the nav, the active page (pets, files, requests,
 * home or sign-in) and the chat dock.
 * @return {JSX.Element} The app shell.
 */
export default function AppShell() {
  const router = useRouter();
  const [active, setActive] = useState('chat');
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  useEffect(() => {
    if (auth && active === 'home') setActive('chat');
    if (!auth && ['pets', 'files', 'requests'].includes(active)) setActive('chat');
  }, [auth, active]);

  /**
   * Switches to the files page for a pet.
   * @param {?string} petId Id of the pet to show, or nothing for the pet list.
   */
  const openFiles = (petId) => {
    setSelectedPetId(petId || null);
    setActive('files');
  };

  /**
   * Signs the user out: clears the session and stored account, starts a fresh
   * anonymous chat identity and returns to the landing page.
   */
  const handleSignOut = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearAuth();
    resetExternalUserId();
    setChatKey((k) => k + 1);
    setAuthState(null);
    router.push('/');
  };

  return (
    <div className={styles['app-shell']}>
      {!showSignIn && (
        <Sidebar
          active={active}
          onNavigate={setActive}
          auth={auth}
          onSignInClick={() => setShowSignIn(true)}
          onSignOut={handleSignOut}
        />
      )}

      <main className={`${styles['app-main']}${active === 'pets' || active === 'files' || active === 'requests' || active === 'home' || showSignIn ? ` ${styles['is-active']}` : ''}`}>
        {showSignIn ? (
          <AuthPage
            onBack={() => setShowSignIn(false)}
            onSuccess={() => {
              setAuthState(getAuth());
              setChatKey((k) => k + 1);
              setShowSignIn(false);
            }}
          />
        ) : active === 'home' ? (
          <MarketingHome auth={auth} onSignInClick={() => setShowSignIn(true)} />
        ) : active === 'files' ? (
          <FilesPage auth={auth} petId={selectedPetId} onSelectPet={setSelectedPetId} onBack={() => setActive('pets')} />
        ) : active === 'requests' ? (
          <RequestsPage auth={auth} onSignInClick={() => setShowSignIn(true)} />
        ) : (
          <Dashboard auth={auth} onSignInClick={() => setShowSignIn(true)} onOpenFiles={openFiles} />
        )}
      </main>

      <aside className={`${styles['app-chat-dock']}${active === 'chat' && !showSignIn ? ` ${styles['is-active']}` : ''}`}>
        <ChatApp key={chatKey} />
      </aside>
    </div>
  );
}
