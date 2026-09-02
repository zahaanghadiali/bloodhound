'use client';

import { useMemo } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { useChat } from '@/lib/chat/useChat';
import { inferInputMode, isLocationPrompt } from '@/lib/chat/inputMode';

export default function ChatApp() {
  const { messages, isTyping, error, send } = useChat();

  const lastBotMessage = useMemo(() => [...messages].reverse().find((m) => m.role === 'bot'), [messages]);
  const inputMode = inferInputMode(lastBotMessage?.text || '');
  const showLocation = isLocationPrompt(lastBotMessage?.text || '');

  const handleOptionSelect = (opt) => {
    if (isTyping) return;
    send({ text: opt.label, payload: opt.value, displayText: opt.label });
  };

  const handleTextSend = (text) => {
    send({ text, displayText: text });
  };

  const handleShareLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      handleTextSend("My browser can't share location — here's my area instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        send({
          location: { lat: latitude, lng: longitude },
          displayText: '📍 Shared my location',
        });
      },
      () => {
        handleTextSend("I couldn't share my location — here's my area instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="chat-shell">
      <div className="chat-window glass">
        <ChatHeader
          disabled={isTyping}
          onRestart={() => send({ text: 'restart', displayText: 'Restart' })}
          onHelp={() => send({ text: 'help', displayText: 'Help' })}
        />
        <MessageList messages={messages} isTyping={isTyping} onOptionSelect={handleOptionSelect} />
        {error && <div className="chat-error">{error}</div>}
        <ChatInput
          onSend={handleTextSend}
          onShareLocation={handleShareLocation}
          disabled={isTyping}
          inputMode={inputMode}
          showLocation={showLocation}
        />
      </div>
    </div>
  );
}
