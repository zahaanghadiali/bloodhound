'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import FilesPage from '@/components/files/FilesPage';
import ChatApp from '@/components/chat/ChatApp';
import SignInModal from '@/components/auth/SignInModal';
import { getAuth, clearAuth } from '@/components/auth/lib/auth';
import styles from './AppShell.module.css';

export default function AppShell() {
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

      <main className={`${styles['app-main']}${active === 'pets' || active === 'files' ? ` ${styles['is-active']}` : ''}`}>
        {active === 'files' ? (
          <FilesPage petId={selectedPetId} onSelectPet={setSelectedPetId} onBack={() => setActive('pets')} />
        ) : (
          <Dashboard auth={auth} onSignInClick={() => setShowSignIn(true)} onOpenFiles={openFiles} />
        )}
      </main>

      <aside className={`${styles['app-chat-dock']}${active === 'chat' ? ` ${styles['is-active']}` : ''}`}>
        <ChatApp />
      </aside>

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSuccess={() => {
            setAuthState(getAuth());
            setShowSignIn(false);
          }}
        />
      )}
    </div>
  );
}
