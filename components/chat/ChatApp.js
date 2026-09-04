'use client';

import { useMemo } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import LocationPicker from './LocationPicker';
import OtpHelper from './OtpHelper';
import PhotoPicker from './PhotoPicker';
import FilePicker from './FilePicker';
import { useChat } from '@/components/chat/lib/useChat';
import { inferInputMode, isLocationPrompt, isOtpPrompt, isPhotoPrompt, isFilePrompt } from '@/components/chat/lib/inputMode';
import styles from './ChatApp.module.css';

export default function ChatApp() {
  const { messages, isTyping, error, send } = useChat();

  const lastBotMessage = useMemo(() => [...messages].reverse().find((m) => m.role === 'bot'), [messages]);
  const promptText = lastBotMessage?.text || '';
  const inputMode = inferInputMode(promptText);
  const showLocationPicker = isLocationPrompt(promptText);
  const showOtpHelper = isOtpPrompt(promptText);
  const showPhotoPicker = isPhotoPrompt(promptText);
  const showFilePicker = isFilePrompt(promptText);

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

  const handleLocationPick = ({ lat, lng, label }) => {
    send({ location: { lat, lng, label }, displayText: `📍 ${label}` });
  };

  const handleResendCode = () => send({ text: 'resend', displayText: 'Resend code' });

  const handleAttachPhoto = (dataUrl) => {
    send({ attachment: { type: 'image', dataUrl }, displayText: '📷 Photo attached' });
  };

  const handleSkipPhoto = () => send({ text: 'skip', displayText: 'Skip' });

  const handleAttachFile = ({ dataUrl, filename, mimeType, sizeBytes }) => {
    send({ attachment: { type: 'file', dataUrl, filename, mimeType, sizeBytes }, displayText: `📎 ${filename}` });
  };

  const handleDoneUploading = () => send({ text: 'done', displayText: 'Done' });

  return (
    <div className={styles['chat-shell']}>
      <div className={`${styles['chat-window']} glass`}>
        <ChatHeader
          disabled={isTyping}
          onRestart={() => send({ text: 'restart', displayText: 'Restart' })}
          onHelp={() => send({ text: 'help', displayText: 'Help' })}
        />
        <MessageList messages={messages} isTyping={isTyping} onOptionSelect={handleOptionSelect} />
        {error && <div className="chat-error">{error}</div>}
        {showLocationPicker && (
          <LocationPicker onSelect={handleLocationPick} onShareCurrent={handleShareLocation} disabled={isTyping} />
        )}
        {showOtpHelper && <OtpHelper onResend={handleResendCode} disabled={isTyping} />}
        {showPhotoPicker && (
          <PhotoPicker onAttach={handleAttachPhoto} onSkip={handleSkipPhoto} disabled={isTyping} />
        )}
        {showFilePicker && (
          <FilePicker onAttach={handleAttachFile} onDone={handleDoneUploading} disabled={isTyping} />
        )}
        <ChatInput onSend={handleTextSend} disabled={isTyping} inputMode={inputMode} />
      </div>
    </div>
  );
}
