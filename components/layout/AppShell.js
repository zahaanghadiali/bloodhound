'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import FilesPage from '@/components/files/FilesPage';
import ChatApp from '@/components/chat/ChatApp';
import AuthPage from '@/components/auth/AuthPage';
import { getAuth, clearAuth } from '@/components/auth/lib/auth';
import styles from './AppShell.module.css';

export default function AppShell() {
  const router = useRouter();
  const [active, setActive] = useState('chat');
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [auth, setAuthState] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    setAuthState(getAuth());
  }, []);

  const openFiles = (petId) => {
    setSelectedPetId(petId || null);
    setActive('files');
  };

  const handleSignOut = () => {
    clearAuth();
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

      <main className={`${styles['app-main']}${active === 'pets' || active === 'files' || showSignIn ? ` ${styles['is-active']}` : ''}`}>
        {showSignIn ? (
          <AuthPage
            onBack={() => setShowSignIn(false)}
            onSuccess={() => {
              setAuthState(getAuth());
              setShowSignIn(false);
            }}
          />
        ) : active === 'files' ? (
          <FilesPage auth={auth} petId={selectedPetId} onSelectPet={setSelectedPetId} onBack={() => setActive('pets')} />
        ) : (
          <Dashboard auth={auth} onSignInClick={() => setShowSignIn(true)} onOpenFiles={openFiles} />
        )}
      </main>

      <aside className={`${styles['app-chat-dock']}${active === 'chat' && !showSignIn ? ` ${styles['is-active']}` : ''}`}>
        <ChatApp />
      </aside>
    </div>
  );
}
