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

/**
 * The chat window: transcript, input bar and whichever helper (location, OTP,
 * photo or file picker) the bot's latest prompt calls for.
 * @return {JSX.Element} The chat window.
 */
export default function ChatApp() {
  const { messages, isTyping, error, send } = useChat();

  const lastBotMessage = useMemo(() => [...messages].reverse().find((m) => m.role === 'bot'), [messages]);
  const promptText = lastBotMessage?.text || '';
  const inputMode = inferInputMode(promptText);
  const showLocationPicker = isLocationPrompt(promptText);
  const showOtpHelper = isOtpPrompt(promptText);
  const showPhotoPicker = isPhotoPrompt(promptText);
  const showFilePicker = isFilePrompt(promptText);

  /**
   * Sends a tapped quick-reply option, unless the bot is still replying.
   * @param {{label: string, value: *}} opt Option the user tapped.
   */
  const handleOptionSelect = (opt) => {
    if (isTyping) return;
    send({ text: opt.label, payload: opt.value, displayText: opt.label });
  };

  /**
   * Sends a typed message.
   * @param {string} text Message text.
   */
  const handleTextSend = (text) => {
    send({ text, displayText: text });
  };

  /**
   * Shares the browser's current position with the bot, or sends a fallback
   * message when geolocation is unavailable or refused.
   */
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

  /**
   * Sends a city picked from the manual location picker.
   * @param {{lat: number, lng: number, label: string, city: string, country:
   *     string, countryCode: string}} location Picked city with its
   *     coordinates.
   */
  const handleLocationPick = (location) => {
    send({ location, displayText: `📍 ${location.label}` });
  };

  /**
   * Asks the bot to resend the verification code.
   * @return {Promise<void>} Resolves once the bot has replied.
   */
  const handleResendCode = () => send({ text: 'resend', displayText: 'Resend code' });

  /**
   * Sends an attached pet photo.
   * @param {string} dataUrl Photo as a base64 data URL.
   */
  const handleAttachPhoto = (dataUrl) => {
    send({ attachment: { type: 'image', dataUrl }, displayText: '📷 Photo attached' });
  };

  /**
   * Tells the bot to skip the pet photo.
   * @return {Promise<void>} Resolves once the bot has replied.
   */
  const handleSkipPhoto = () => send({ text: 'skip', displayText: 'Skip' });

  /**
   * Sends an attached medical record file.
   * @param {{dataUrl: string, filename: string, mimeType: string, sizeBytes:
   *     number}} file File contents and metadata.
   */
  const handleAttachFile = ({ dataUrl, filename, mimeType, sizeBytes }) => {
    send({ attachment: { type: 'file', dataUrl, filename, mimeType, sizeBytes }, displayText: `📎 ${filename}` });
  };

  /**
   * Tells the bot that no more files will be uploaded.
   * @return {Promise<void>} Resolves once the bot has replied.
   */
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
