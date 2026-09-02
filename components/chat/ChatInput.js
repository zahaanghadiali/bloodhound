'use client';

import { useState } from 'react';
import { Send, MapPin } from '@/components/icons/Icons';

const HTML_TYPE_BY_MODE = {
  date: 'date',
  tel: 'tel',
  email: 'email',
  number: 'number',
  text: 'text',
};

export default function ChatInput({ onSend, onShareLocation, disabled, inputMode, showLocation }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="chat-input" onSubmit={submit}>
      {showLocation && (
        <button
          type="button"
          className="icon-btn"
          onClick={onShareLocation}
          disabled={disabled}
          aria-label="Share my location"
          title="Share my location"
        >
          <MapPin size={20} />
        </button>
      )}
      <input
        type={HTML_TYPE_BY_MODE[inputMode] || 'text'}
        inputMode={inputMode === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message"
        disabled={disabled}
        className="chat-input__field"
        autoComplete="off"
      />
      <button type="submit" className="icon-btn icon-btn--send" disabled={disabled || !value.trim()} aria-label="Send">
        <Send size={20} />
      </button>
    </form>
  );
}
