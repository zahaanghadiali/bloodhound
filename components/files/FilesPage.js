'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, FileText, ImageIcon, Trash, Dog, Cat } from '@/components/icons/Icons';

const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];
const ACCEPTED_ATTR = '.pdf,.docx,image/*';
const MAX_BYTES = 10 * 1024 * 1024;

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

function formatBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PetAvatar({ pet, size = 20 }) {
  const Icon = pet?.species === 'cat' ? Cat : Dog;
  return (
    <span className={`health-card__avatar health-card__avatar--${pet?.species || 'dog'}`}>
      {pet?.photoUrl ? <img src={pet.photoUrl} alt="" /> : <Icon size={size} />}
    </span>
  );
}

function PetPicker({ onSelect, onBack }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pets')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setPets(data.pets || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="files-page">
      <div className="files-page__header">
        <button type="button" className="files-page__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="files-page__headings">
          <h2 className="files-page__title">Choose a pet</h2>
          <p className="files-page__subtitle">Pick who these files are for</p>
        </div>
      </div>

      {loading ? (
        <div className="pet-picker">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pet-picker__item pet-picker__item--skeleton" />
          ))}
        </div>
      ) : pets.length === 0 ? (
        <p className="files-page__empty">No pets yet — add one first.</p>
      ) : (
        <div className="pet-picker">
          {pets.map((pet) => (
            <button key={pet._id} type="button" className="pet-picker__item" onClick={() => onSelect(pet._id)}>
              <PetAvatar pet={pet} />
              <span className="pet-picker__name">{pet.name || 'Unnamed'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PetFiles({ petId, onBack }) {
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const loadPet = useCallback(() => {
    setLoading(true);
    return fetch(`/api/pets/${petId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load pet');
        return res.json();
      })
      .then((data) => setPet(data.pet))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [petId]);

  useEffect(() => {
    setPet(null);
    setError(null);
    loadPet();
  }, [loadPet]);

  const uploadFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      setError(null);
      setUploading(true);
      try {
        for (const file of files) {
          if (!isAccepted(file)) {
            setError('Only PDF, DOCX and image files are supported.');
            continue;
          }
          if (file.size > MAX_BYTES) {
            setError('Files must be under 10MB.');
            continue;
          }
          const dataUrl = await readAsDataUrl(file);
          const res = await fetch(`/api/pets/${petId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, mimeType: file.type, url: dataUrl, sizeBytes: file.size }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Upload failed');
          }
        }
        await loadPet();
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [petId, loadPet]
  );

  const handleInputChange = (e) => {
    uploadFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (docId) => {
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove file');
      const data = await res.json();
      setPet(data.pet);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (doc) => {
    setError(null);
    const nextStatus = doc.status === 'verified' ? 'pending' : 'verified';
    try {
      const res = await fetch(`/api/pets/${petId}/documents/${doc._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update file status');
      const data = await res.json();
      setPet(data.pet);
    } catch (err) {
      setError(err.message);
    }
  };

  const documents = pet?.documents || [];

  return (
    <div className="files-page">
      <div className="files-page__header">
        <button type="button" className="files-page__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <PetAvatar pet={pet} />
        <div className="files-page__headings">
          <h2 className="files-page__title">{pet ? `${pet.name || 'Unnamed'}'s files` : 'Loading…'}</h2>
          <p className="files-page__subtitle">Medical records · {documents.length}</p>
        </div>
        <button
          type="button"
          className="chip-btn chip-btn--primary files-page__upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || loading}
        >
          <Upload size={15} />
          {uploading ? 'Uploading…' : 'Upload file'}
        </button>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div
        className={`files-dropzone${dragActive ? ' files-dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <span className="files-dropzone__icon">
          <Upload size={22} />
        </span>
        <p className="files-dropzone__title">Drag &amp; drop medical records</p>
        <p className="files-dropzone__subtitle">Vaccination cards, lab results, vet notes — PDF, DOCX, JPG, PNG</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED_ATTR} onChange={handleInputChange} hidden />
      </div>

      <div className="files-list">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="file-row file-row--skeleton" />)
        ) : documents.length === 0 ? (
          <p className="files-page__empty">No files uploaded yet.</p>
        ) : (
          [...documents].reverse().map((doc) => (
            <div key={doc._id} className="file-row">
              <span className="file-row__icon">
                {doc.mimeType?.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
              </span>
              <div className="file-row__meta">
                <span className="file-row__name">{doc.filename}</span>
                <span className="file-row__sub">
                  {formatBytes(doc.sizeBytes)} · Uploaded {formatDate(doc.uploadedAt)}
                </span>
              </div>
              <button
                type="button"
                className={`status-pill status-pill--toggle status-pill--${doc.status === 'verified' ? 'verified' : 'pending'}`}
                onClick={() => handleToggleStatus(doc)}
                title={doc.status === 'verified' ? 'Mark as pending review' : 'Mark as verified'}
              >
                {doc.status === 'verified' ? 'Verified' : 'Pending review'}
              </button>
              <button
                type="button"
                className="file-row__delete"
                onClick={() => handleDelete(doc._id)}
                aria-label="Delete file"
              >
                <Trash size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function FilesPage({ petId, onSelectPet, onBack }) {
  if (!petId) {
    return <PetPicker onSelect={onSelectPet} onBack={onBack} />;
  }
  return <PetFiles petId={petId} onBack={onBack} />;
}
