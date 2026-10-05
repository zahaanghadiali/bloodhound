'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getExternalUserId } from './session';
import { postIncoming } from './api';

const HISTORY_KEY_PREFIX = 'bloodhound.history.';

/**
 * Loads the saved chat transcript for a user from localStorage.
 * @param {?string} userId External user id.
 * @return {Array<Object>} Saved messages, or an empty array if there are none
 *     or they are unreadable.
 */
function loadHistory(userId) {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves the chat transcript for a user to localStorage, leaving out file
 * attachments because they are short-lived and large.
 * @param {?string} userId External user id.
 * @param {Array<Object>} messages Transcript to save.
 */
function saveHistory(userId, messages) {
  if (!userId || typeof window === 'undefined') return;
  const persistable = messages.map(({ file, ...rest }) => rest);
  window.localStorage.setItem(HISTORY_KEY_PREFIX + userId, JSON.stringify(persistable));
}

let idCounter = 0;
/**
 * Generates a unique id for a chat message.
 * @return {string} An id made of the current time and a counter.
 */
function nextId() {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

/**
 * React hook that owns the chat transcript and talks to the chat endpoint. The
 * transcript is mirrored to localStorage so a refresh keeps the visible
 * history.
 * @return {{messages: Array<Object>, isTyping: boolean, error: ?string, send:
 *     function(Object): Promise<void>, userId: ?string}} Chat state and the
 *     function used to send a message.
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

  /**
   * Sends a message to the bot and appends the user's message and the bot's
   * replies to the transcript.
   * @param {{text: (string|undefined), payload: *, location: ?Object,
   *     attachment: ?Object, displayText: ?string, silent:
   *     (boolean|undefined)}} message Message to send; displayText replaces
   *     text in the transcript and silent skips adding the user's message.
   * @return {Promise<void>} Resolves once the replies have arrived; a failure
   *     is stored in the hook's error state.
   */
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
