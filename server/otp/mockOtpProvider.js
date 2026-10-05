const OtpProvider = require('./providerInterface');
const logger = require('../utils/logger');

class MockOtpProvider extends OtpProvider {
  /**
   * Logs the code instead of delivering it. otpService detects this provider
   * and echoes the code into the chat reply, so verification works with no API
   * keys.
   * @param {string} target Phone number or email the code is for.
   * @param {string} code Verification code.
   * @return {Promise<void>} Resolves once the code has been logged.
   */
  async send(target, code) {
    logger.info('mock otp send', { target, code });
  }
}

module.exports = new MockOtpProvider();
