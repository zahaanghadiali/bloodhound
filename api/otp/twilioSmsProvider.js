const OtpProvider = require('./providerInterface');
const { twilio } = require('../config/env');
const logger = require('../utils/logger');

/** Sends SMS via Twilio's Programmable Messaging REST API. */
class TwilioSmsProvider extends OtpProvider {
  // eslint-disable-next-line class-methods-use-this
  async send(target, code) {
    const { accountSid, authToken, fromNumber } = twilio;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: target,
      From: fromNumber,
      Body: `Your Bloodhound verification code is ${code}. It expires in 5 minutes.`,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error('twilio sms send failed', { status: res.status, body: errBody });
      throw new Error('Failed to send the SMS verification code. Please try again shortly.');
    }
  }
}

module.exports = new TwilioSmsProvider();
