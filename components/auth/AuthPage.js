'use client';

import { useState } from 'react';
import { Phone, ArrowLeft } from '@/components/icons/Icons';
import { getExternalUserId } from '@/components/chat/lib/session';
import { setAuth } from './lib/auth';
import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_CODE } from './lib/countryDialCodes';
import styles from './AuthPage.module.css';

/**
 * Posts a JSON body and parses the JSON response.
 * @param {string} url Endpoint to post to.
 * @param {Object} body Payload to send.
 * @return {Promise<Object>} The parsed response body.
 * @throws {Error} If the response status is not 2xx, with the server's error
 *     message when it sent one.
 */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/**
 * Phone and OTP sign-in page, rendered in the main content column.
 * @param {{onBack: function(): void, onSuccess: (function(Object):
 *     void|undefined)}} props onBack leaves the page; onSuccess receives the
 *     signed-in pet parent.
 * @return {JSX.Element} The sign-in form.
 */
export default function AuthPage({ onBack, onSuccess }) {
  const [step, setStep] = useState('phone');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [localNumber, setLocalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dial = COUNTRY_DIAL_CODES.find((c) => c.code === countryCode)?.dial || '+1';
  const fullNumber = `${dial}${localNumber.replace(/\D/g, '')}`;

  /**
   * Requests a sign-in code for the entered number and moves to the code step.
   * @param {Event=} e Form submit event.
   * @return {Promise<void>} Resolves once the request has finished; a failure
   *     is shown in the form.
   */
  const requestCode = async (e) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJson('/api/auth/request-otp', { phone: fullNumber, externalUserId: getExternalUserId() });
      setPhone(data.phone);
      setDevCode(data.devCode);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifies the entered code, stores the signed-in account and reports
   * success.
   * @param {Event=} e Form submit event.
   * @return {Promise<void>} Resolves once verification has finished; a failure
   *     is shown in the form.
   */
  const verify = async (e) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const externalUserId = getExternalUserId();
      const data = await postJson('/api/auth/verify-otp', { phone, code, externalUserId });
      setAuth({
        phone,
        name: data.parent?.name || null,
        parentId: data.parent?._id,
        externalUserId,
        verifiedAt: new Date().toISOString(),
      });
      onSuccess?.(data.parent);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Requests a fresh sign-in code for the same number.
   * @return {Promise<void>} Resolves once the request has finished; a failure
   *     is shown in the form.
   */
  const resend = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await postJson('/api/auth/resend-otp', { phone, externalUserId: getExternalUserId() });
      setDevCode(data.devCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['auth-page']}>
      <div className={`${styles['auth-page__card']} glass`}>
        <button type="button" className={styles['auth-page__leave']} onClick={onBack} aria-label="Back">
          <ArrowLeft size={16} />
          Back
        </button>

        <div className={styles['auth-page__icon']}>
          <Phone size={22} />
        </div>

        {step === 'phone' ? (
          <form onSubmit={requestCode}>
            <h1 className={styles['auth-page__title']}>Sign in</h1>
            <p className={styles['auth-page__subtitle']}>Enter your phone number and we&apos;ll text you a code.</p>
            <div className={styles['auth-page__phone-row']}>
              <select
                className={styles['auth-page__country-select']}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country code"
              >
                {COUNTRY_DIAL_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                className={`${styles['auth-page__input']} ${styles['auth-page__input--phone']}`}
                placeholder="98765 43210"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && <div className="chat-error">{error}</div>}
            <button
              type="submit"
              className={`chip-btn chip-btn--primary ${styles['auth-page__submit']}`}
              disabled={loading || !localNumber.trim()}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <button type="button" className={styles['auth-page__step-back']} onClick={() => setStep('phone')}>
              <ArrowLeft size={14} />
              {phone}
            </button>
            <h1 className={styles['auth-page__title']}>Enter the code</h1>
            <p className={styles['auth-page__subtitle']}>
              We texted a 6-digit code to {phone}.
              {devCode && <span className={styles['auth-page__dev-code']}> 🧪 Dev mode — your code is {devCode}</span>}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={`${styles['auth-page__input']} ${styles['auth-page__input--code']}`}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
            {error && <div className="chat-error">{error}</div>}
            <button type="submit" className={`chip-btn chip-btn--primary ${styles['auth-page__submit']}`} disabled={loading || code.length < 4}>
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button type="button" className={styles['auth-page__resend']} onClick={resend} disabled={loading}>
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
