'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import FilesPage from '@/components/files/FilesPage';
import ChatApp from '@/components/chat/ChatApp';

export default function AppShell() {
  const [active, setActive] = useState('chat');
  const [selectedPetId, setSelectedPetId] = useState(null);

  const openFiles = (petId) => {
    setSelectedPetId(petId || null);
    setActive('files');
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} />

      <main className={`app-main${active === 'pets' || active === 'files' ? ' is-active' : ''}`}>
        {active === 'files' ? (
          <FilesPage petId={selectedPetId} onSelectPet={setSelectedPetId} onBack={() => setActive('pets')} />
        ) : (
          <Dashboard onRequestBlood={() => setActive('chat')} onOpenFiles={openFiles} />
        )}
      </main>

      <aside className={`app-chat-dock${active === 'chat' ? ' is-active' : ''}`}>
        <ChatApp />
      </aside>
    </div>
  );
}
