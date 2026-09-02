const OtpProvider = require('./providerInterface');
const { resend } = require('../config/env');
const logger = require('../utils/logger');

/** Sends email via the Resend REST API. */
class ResendEmailProvider extends OtpProvider {
  // eslint-disable-next-line class-methods-use-this
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
