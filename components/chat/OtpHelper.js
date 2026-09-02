export default function OtpHelper({ onResend, disabled }) {
  return (
    <div className="otp-helper">
      <button type="button" className="chip-btn" onClick={onResend} disabled={disabled}>
        Resend code
      </button>
    </div>
  );
}
