'use client';

import { useState } from 'react';
import { Send } from '@/components/icons/Icons';
import styles from './ChatInput.module.css';

const HTML_TYPE_BY_MODE = {
  date: 'date',
  tel: 'tel',
  email: 'email',
  number: 'number',
};

export default function ChatInput({ onSend, disabled, inputMode }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className={styles['chat-input']} onSubmit={submit}>
      <input
        type={HTML_TYPE_BY_MODE[inputMode] || 'text'}
        inputMode={inputMode === 'number' ? 'decimal' : inputMode === 'otp' ? 'numeric' : undefined}
        maxLength={inputMode === 'otp' ? 6 : undefined}
        autoComplete={inputMode === 'otp' ? 'one-time-code' : 'off'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={inputMode === 'otp' ? '6-digit code' : 'Type a message'}
        disabled={disabled}
        className={styles['chat-input__field']}
      />
      <button type="submit" className="icon-btn icon-btn--send" disabled={disabled || !value.trim()} aria-label="Send">
        <Send size={20} />
      </button>
    </form>
  );
}
