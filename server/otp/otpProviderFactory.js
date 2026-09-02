const mockOtpProvider = require('./mockOtpProvider');
const twilioSmsProvider = require('./twilioSmsProvider');
const resendEmailProvider = require('./resendEmailProvider');
const { otp } = require('../config/env');

const smsProviders = { mock: mockOtpProvider, twilio: twilioSmsProvider };
const emailProviders = { mock: mockOtpProvider, resend: resendEmailProvider };

function getSmsProvider() {
  return smsProviders[otp.smsProvider] || mockOtpProvider;
}

function getEmailProvider() {
  return emailProviders[otp.emailProvider] || mockOtpProvider;
}

module.exports = { getSmsProvider, getEmailProvider, mockOtpProvider };
