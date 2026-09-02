'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import PetsDashboard from '@/components/pets/PetsDashboard';
import ChatApp from '@/components/chat/ChatApp';

export default function AppShell() {
  const [active, setActive] = useState('pets');

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} />

      <main className="app-main glass">
        <PetsDashboard />
      </main>

      <aside className="app-chat-dock">
        <ChatApp />
      </aside>
    </div>
  );
}
