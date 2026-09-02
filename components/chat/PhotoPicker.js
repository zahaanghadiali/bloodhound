'use client';

import { useRef, useState } from 'react';
import { Camera } from '@/components/icons/Icons';

const MAX_BYTES = 5 * 1024 * 1024;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoPicker({ onAttach, onSkip, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

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
    <div className="photo-picker">
      <div className="photo-picker__actions">
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
