const mockOtpProvider = require('./mockOtpProvider');
const twilioSmsProvider = require('./twilioSmsProvider');
const resendEmailProvider = require('./resendEmailProvider');
const { otp } = require('../config/env');

const smsProviders = { mock: mockOtpProvider, twilio: twilioSmsProvider };
const emailProviders = { mock: mockOtpProvider, resend: resendEmailProvider };

/**
 * Returns the SMS OTP provider selected by OTP_SMS_PROVIDER.
 * @return {Object} The configured provider, or the mock provider if the setting
 *     is unknown.
 */
function getSmsProvider() {
  return smsProviders[otp.smsProvider] || mockOtpProvider;
}

/**
 * Returns the email OTP provider selected by OTP_EMAIL_PROVIDER.
 * @return {Object} The configured provider, or the mock provider if the setting
 *     is unknown.
 */
function getEmailProvider() {
  return emailProviders[otp.emailProvider] || mockOtpProvider;
}

module.exports = { getSmsProvider, getEmailProvider, mockOtpProvider };
