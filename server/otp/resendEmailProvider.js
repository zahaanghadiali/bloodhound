const OtpProvider = require('./providerInterface');
const { resend } = require('../config/env');
const logger = require('../utils/logger');

class ResendEmailProvider extends OtpProvider {
  /**
   * Emails a verification code through the Resend REST API.
   * @param {string} target Email address to send the code to.
   * @param {string} code Verification code.
   * @return {Promise<void>} Resolves once Resend has accepted the email.
   * @throws {Error} If Resend rejects the request.
   */
  async send(target, code) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resend.fromAddress,
        to: [target],
        subject: 'Your Bloodhound verification code',
        html: `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p>`,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error('resend email send failed', { status: res.status, body: errBody });
      throw new Error('Failed to send the email verification code. Please try again shortly.');
    }
  }
}

module.exports = new ResendEmailProvider();
