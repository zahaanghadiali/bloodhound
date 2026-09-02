const OtpProvider = require('./providerInterface');
const logger = require('../utils/logger');

/**
 * Local/testing provider — no SMS or email vendor involved. otpService
 * detects this provider by reference and echoes the code back into the
 * chat reply itself, so the whole verification flow is testable with zero
 * API keys.
 */
class MockOtpProvider extends OtpProvider {
  // eslint-disable-next-line class-methods-use-this
  async send(target, code) {
    logger.info('mock otp send', { target, code });
  }
}

module.exports = new MockOtpProvider();
