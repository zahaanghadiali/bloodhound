'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dog, Cat, Phone } from '@/components/icons/Icons';
import styles from './RequestsPage.module.css';

function speciesIcon(species) {
  return species === 'cat' ? Cat : Dog;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PHASE_LABEL = {
  active: 'Searching',
  awaiting_unlimited_confirmation: 'Awaiting your input',
  unlimited: 'Searching (unlimited)',
  stopped: 'Stopped',
  expired: 'Expired (no response)',
};

const RECEIVED_STATUS_PILL = {
  accepted: 'status-pill--verified',
  declined: 'status-pill--deleted',
  pending: 'status-pill--pending',
  expired: 'status-pill--paused',
};

const RECEIVED_STATUS_LABEL = {
  accepted: 'Accepted',
  declined: 'Declined',
  pending: 'Pending',
  expired: 'Expired (no response)',
};

function SentCard({ request, onStop }) {
  const Icon = speciesIcon(request.species);
  const isClosed = request.phase === 'stopped' || request.phase === 'expired';
  const canStop = !isClosed;
  const [busy, setBusy] = useState(false);

  return (
    <div className={`${styles.card} glass`}>
      <div className={styles['card__top']}>
        <span className={`${styles['card__avatar']} ${styles[`card__avatar--${request.species}`]}`}>
          <Icon size={20} />
        </span>
        <div className={styles['card__body']}>
          <h3 className={styles['card__title']}>{request.locationText || 'Your area'}</h3>
          <p className={styles['card__meta']}>
            {request.searchMode === 'text' ? 'City/area search' : `${request.currentRadiusKm}km of ${request.maxRadiusKm}km max`} · {formatDate(request.createdAt)}
          </p>
        </div>
        <span className={`status-pill ${isClosed ? 'status-pill--paused' : 'status-pill--active'}`}>
          {PHASE_LABEL[request.phase] || request.phase}
        </span>
      </div>

      {request.accepted.length > 0 ? (
        <div className={styles['card__accepted']}>
          {request.accepted.map((a, i) => (
            <div key={i} className={styles['card__accepted-row']}>
              <span className="status-pill status-pill--verified">Accepted</span>
              <span>{a.pet?.name || 'A pet'} {a.pet?.species === 'cat' ? '🐱' : '🐶'}</span>
              <span className={styles['card__contact']}>
                <Phone size={12} /> {a.owner?.name || 'Unknown'} · {a.owner?.phone || 'N/A'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles['card__empty-note']}>No one has accepted yet — we'll widen the search automatically.</p>
      )}

      {canStop && (
        <button
          type="button"
          className="chip-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStop(request._id);
            setBusy(false);
          }}
        >
          Stop searching
        </button>
      )}
    </div>
  );
}

function ReceivedCard({ request, onRespond }) {
  const Icon = speciesIcon(request.species);
  const [selectedPetId, setSelectedPetId] = useState(request.eligiblePets[0]?._id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isPending = request.myStatus === 'pending';

  const respond = async (accepted) => {
    setError(null);
    if (accepted && request.eligiblePets.length > 1 && !selectedPetId) {
      setError('Choose which pet will be donating.');
      return;
    }
    setBusy(true);
    try {
      await onRespond(request._id, { accepted, petId: accepted ? selectedPetId : undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.card} glass`}>
      <div className={styles['card__top']}>
        <span className={`${styles['card__avatar']} ${styles[`card__avatar--${request.species}`]}`}>
          <Icon size={20} />
        </span>
        <div className={styles['card__body']}>
          <h3 className={styles['card__title']}>{request.species === 'cat' ? 'Cat' : 'Dog'} blood donor needed</h3>
          <p className={styles['card__meta']}>
            {request.locationText || 'Nearby'} · {formatDate(request.createdAt)}
          </p>
        </div>
        <span className={`status-pill ${RECEIVED_STATUS_PILL[request.myStatus] || 'status-pill--pending'}`}>
          {RECEIVED_STATUS_LABEL[request.myStatus] || 'Pending'}
        </span>
      </div>

      <div className={styles['card__contact']}>
        <Phone size={12} /> {request.searcher?.name || 'Unknown'} · {request.searcher?.phone || 'N/A'}
      </div>

      {request.myStatus === 'accepted' && request.myPet && (
        <p className={styles['card__empty-note']}>You offered {request.myPet.name || 'your pet'} — they'll reach out directly.</p>
      )}

      {isPending && (
        <>
          {request.eligiblePets.length === 0 ? (
            <p className={styles['card__empty-note']}>You don't have an eligible pet for this right now.</p>
          ) : request.eligiblePets.length > 1 ? (
            <select
              className={styles['card__pet-select']}
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
            >
              <option value="" disabled>
                Which pet will be donating?
              </option>
              {request.eligiblePets.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name || 'Unnamed'}
                </option>
              ))}
            </select>
          ) : null}

          {error && <div className="chat-error">{error}</div>}

          <div className={styles['card__actions']}>
            <button
              type="button"
              className="chip-btn chip-btn--primary"
              disabled={busy || request.eligiblePets.length === 0}
              onClick={() => respond(true)}
            >
              Accept
            </button>
            <button type="button" className="chip-btn" disabled={busy} onClick={() => respond(false)}>
              Decline
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const POLL_INTERVAL_MS = 5000;

export default function RequestsPage({ auth, onSignInClick }) {
  const [tab, setTab] = useState('received');
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // isInitial gates the loading skeleton — background polls (the actual
  // "did anyone accept yet?" mechanism, since this channel has no live push
  // the way WhatsApp does) shouldn't flash the whole list to a skeleton.
  const load = useCallback(async (isInitial, { signal } = {}) => {
    if (!auth) return;
    if (isInitial) setLoading(true);
    try {
      const [sentRes, receivedRes] = await Promise.all([
        fetch('/api/donor-requests/sent', { signal }),
        fetch('/api/donor-requests/received', { signal }),
      ]);
      if (!sentRes.ok || !receivedRes.ok) throw new Error('Failed to load requests');
      const sentData = await sentRes.json();
      const receivedData = await receivedRes.json();
      setSent(sentData.requests || []);
      setReceived(receivedData.requests || []);
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return undefined;

    let cancelled = false;
    let timer;
    const controller = new AbortController();

    const scheduleNext = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load(false, { signal: controller.signal });
        if (!cancelled) scheduleNext();
      }, POLL_INTERVAL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false, { signal: controller.signal });
    };
    document.addEventListener('visibilitychange', onVisible);

    load(true, { signal: controller.signal }).then(() => {
      if (!cancelled) scheduleNext();
    });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [auth, load]);

  const handleStop = async (id) => {
    await fetch(`/api/donor-requests/sent/${id}/stop`, { method: 'POST' });
    await load(false);
  };

  const handleRespond = async (id, body) => {
    const res = await fetch(`/api/donor-requests/received/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Something went wrong.');
    }
    await load(false);
  };

  if (!auth) {
    return (
      <div className={styles['requests-page']}>
        <div className={styles['requests-page__signin-gate']}>
          <span className={styles['requests-page__signin-icon']}>
            <Phone size={22} />
          </span>
          <h2 className={styles['requests-page__signin-title']}>Sign in to see your requests</h2>
          <p className={styles['requests-page__signin-subtitle']}>Verify your phone number to view donor requests you've sent or received.</p>
          <button type="button" className="chip-btn chip-btn--primary" onClick={onSignInClick}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const pendingCount = received.filter((r) => r.myStatus === 'pending').length;
  const acceptedCount = sent.reduce((n, r) => n + r.accepted.length, 0);
  const list = tab === 'received' ? received : sent;

  return (
    <div className={styles['requests-page']}>
      <div className={styles['requests-page__header']}>
        <h1 className={styles['requests-page__title']}>Requests</h1>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabs__item}${tab === 'received' ? ` ${styles['tabs__item--active']}` : ''}`}
            onClick={() => setTab('received')}
          >
            Received{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
          <button
            type="button"
            className={`${styles.tabs__item}${tab === 'sent' ? ` ${styles['tabs__item--active']}` : ''}`}
            onClick={() => setTab('sent')}
          >
            Sent{acceptedCount > 0 ? ` (${acceptedCount})` : ''}
          </button>
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      {loading ? (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles['card--skeleton']} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className={styles['requests-page__empty']}>
          <p>{tab === 'received' ? "You haven't been asked to help with any donor requests yet." : "You haven't started any donor searches yet."}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {tab === 'received'
            ? received.map((r) => <ReceivedCard key={r._id} request={r} onRespond={handleRespond} />)
            : sent.map((r) => <SentCard key={r._id} request={r} onStop={handleStop} />)}
        </div>
      )}
    </div>
  );
}
