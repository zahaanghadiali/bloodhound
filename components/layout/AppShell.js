'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import PetsDashboard from '@/components/pets/PetsDashboard';
import ChatApp from '@/components/chat/ChatApp';

export default function AppShell() {
  const [active, setActive] = useState('chat');

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} />

      <main className={`app-main glass${active === 'pets' ? ' is-active' : ''}`}>
        <PetsDashboard />
      </main>

      <aside className={`app-chat-dock${active === 'chat' ? ' is-active' : ''}`}>
        <ChatApp />
      </aside>
    </div>
  );
}
