'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import OptionButtons from './OptionButtons';
import TypingIndicator from './TypingIndicator';

export default function MessageList({ messages, isTyping, onOptionSelect }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  const lastBotIndex = messages.map((m) => m.role).lastIndexOf('bot');

  return (
    <div className="message-list">
      {messages.map((m, i) => (
        <div key={m.id}>
          <MessageBubble role={m.role} text={m.text} image={m.image} />
          {m.role === 'bot' && m.options && (
            <OptionButtons options={m.options} onSelect={onOptionSelect} disabled={i !== lastBotIndex || isTyping} />
          )}
        </div>
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
