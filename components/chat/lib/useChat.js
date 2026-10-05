'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getExternalUserId } from './session';
import { postIncoming } from './api';

const HISTORY_KEY_PREFIX = 'bloodhound.history.';

function loadHistory(userId) {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(userId, messages) {
  if (!userId || typeof window === 'undefined') return;
  // A bot message's `file` is a short-lived signed URL (or a whole base64
  // data URL) — no use after a refresh, and big enough to blow the quota.
  const persistable = messages.map(({ file, ...rest }) => rest);
  window.localStorage.setItem(HISTORY_KEY_PREFIX + userId, JSON.stringify(persistable));
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

/**
 * Owns the chat transcript and talks to /api/mock/incoming. The transcript
 * is mirrored to localStorage (per externalUserId) purely so a page refresh
 * doesn't lose the visible history — the flow's real state of record lives
 * in the Conversation document on the server.
 */
export function useChat() {
  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const id = getExternalUserId();
    setUserId(id);
    setMessages(loadHistory(id));
  }, []);

  const send = useCallback(async ({ text = '', payload = null, location = null, attachment = null, displayText = null, silent = false }) => {
    const id = getExternalUserId();
    if (!id) return;

    if (!silent && (text || displayText || attachment)) {
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            text: displayText || text,
            image: attachment?.type === 'image' ? attachment.dataUrl || null : null,
          },
        ];
        saveHistory(id, next);
        return next;
      });
    }

    setIsTyping(true);
    setError(null);
    try {
      const replies = await postIncoming({ externalUserId: id, text, payload, location, attachment });
      setMessages((prev) => {
        const next = [
          ...prev,
          ...replies.map((r) => ({ id: nextId(), role: 'bot', text: r.text, options: r.options || null, file: r.media || null })),
        ];
        saveHistory(id, next);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTyping(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || startedRef.current) return;
    startedRef.current = true;
    if (messages.length === 0) {
      send({ silent: true });
    }
  }, [userId, messages.length, send]);

  return { messages, isTyping, error, send, userId };
}
