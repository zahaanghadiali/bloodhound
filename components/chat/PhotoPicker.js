'use client';

import { useRef, useState } from 'react';
import { Camera } from '@/components/icons/Icons';
import styles from './PhotoPicker.module.css';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Reads a file as a base64 data URL.
 * @param {File} file File to read.
 * @return {Promise<string>} The file as a data URL.
 * @throws {ProgressEvent} If the file cannot be read (as a rejection).
 */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Buttons for attaching a pet photo or skipping it.
 * @param {{onAttach: function(string): void, onSkip: function(): void,
 *     disabled: boolean}} props onAttach receives the photo as a data URL.
 * @return {JSX.Element} The picker.
 */
export default function PhotoPicker({ onAttach, onSkip, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  /**
   * Validates the chosen image's type and size (5 MB at most) and attaches it.
   * @param {Event} e Change event from the file input.
   * @return {Promise<void>} Resolves once the photo has been read and attached.
   */
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That photo is too large — please pick one under 5MB.');
      return;
    }
    setError(null);
    const dataUrl = await readAsDataUrl(file);
    onAttach(dataUrl);
  };

  return (
    <div className={styles['photo-picker']}>
      <div className={styles['photo-picker__actions']}>
        <button
          type="button"
          className="chip-btn chip-btn--primary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Camera size={16} />
          Attach a photo
        </button>
        <button type="button" className="chip-btn" onClick={onSkip} disabled={disabled}>
          Skip — use an icon
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        hidden
      />
      {error && <div className="chat-error">{error}</div>}
    </div>
  );
}
