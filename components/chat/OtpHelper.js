import styles from './OtpHelper.module.css';

/**
 * "Resend code" button shown while the bot waits for a verification code.
 * @param {{onResend: function(): void, disabled: boolean}} props Resend
 *     handler, and whether the button is disabled.
 * @return {JSX.Element} The helper row.
 */
export default function OtpHelper({ onResend, disabled }) {
  return (
    <div className={styles['otp-helper']}>
      <button type="button" className="chip-btn" onClick={onResend} disabled={disabled}>
        Resend code
      </button>
    </div>
  );
}
