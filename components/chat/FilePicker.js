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

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isAccepted(file) {
  if (ACCEPTED_MIME.includes(file.type)) return true;
  return /\.(pdf|docx)$/i.test(file.name);
}

export default function FilePicker({ onAttach, onDone, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

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
