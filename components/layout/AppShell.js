'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import FilesPage from '@/components/files/FilesPage';
import RequestsPage from '@/components/requests/RequestsPage';
import ChatApp from '@/components/chat/ChatApp';
import AuthPage from '@/components/auth/AuthPage';
import { getAuth, clearAuth } from '@/components/auth/lib/auth';
import { resetExternalUserId } from '@/components/chat/lib/session';
import styles from './AppShell.module.css';

export default function AppShell() {
  const router = useRouter();
  const [active, setActive] = useState('chat');
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  // Bumped on sign-in and sign-out to force ChatApp to remount onto the
  // correct identity's chat state, instead of carrying the previous
  // session's transcript/in-progress flow across the identity switch.
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  const openFiles = (petId) => {
    setSelectedPetId(petId || null);
    setActive('files');
  };

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

      <main className={`${styles['app-main']}${active === 'pets' || active === 'files' || active === 'requests' || showSignIn ? ` ${styles['is-active']}` : ''}`}>
        {showSignIn ? (
          <AuthPage
            onBack={() => setShowSignIn(false)}
            onSuccess={() => {
              setAuthState(getAuth());
              setChatKey((k) => k + 1);
              setShowSignIn(false);
            }}
          />
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
