'use client';

import { useRef, useState } from 'react';
import { Upload } from '@/components/icons/Icons';
import styles from './FilePicker.module.css';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];

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
 * Checks whether a file is an accepted medical record type.
 * @param {File} file File chosen by the user.
 * @return {boolean} True for PDF, DOCX and supported image files.
 */
function isAccepted(file) {
  if (ACCEPTED_MIME.includes(file.type)) return true;
  return /\.(pdf|docx)$/i.test(file.name);
}

/**
 * Buttons for attaching medical record files and finishing the upload.
 * @param {{onAttach: function(Object): void, onDone: function(): void,
 *     disabled: boolean}} props onAttach receives {dataUrl, filename, mimeType,
 *     sizeBytes} for each file.
 * @return {JSX.Element} The picker.
 */
export default function FilePicker({ onAttach, onDone, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  /**
   * Validates the chosen file's type and size (10 MB at most) and attaches it.
   * @param {Event} e Change event from the file input.
   * @return {Promise<void>} Resolves once the file has been read and attached.
   */
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAccepted(file)) {
      setError('Please choose a PDF, DOCX or image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is too large — please pick one under 10MB.');
      return;
    }
    setError(null);
    const dataUrl = await readAsDataUrl(file);
    onAttach({ dataUrl, filename: file.name, mimeType: file.type, sizeBytes: file.size });
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
          <Upload size={16} />
          Attach a file
        </button>
        <button type="button" className="chip-btn" onClick={onDone} disabled={disabled}>
          Done uploading
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,image/*"
        onChange={handleFile}
        hidden
      />
      {error && <div className="chat-error">{error}</div>}
    </div>
  );
}
