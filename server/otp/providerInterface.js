class OtpProvider {
  /**
   * Delivers a verification code to a phone number or email address.
   * @param {string} target Phone number or email address to send the code to.
   * @param {string} code Verification code.
   * @return {Promise<void>} Resolves once the code has been sent.
   * @throws {Error} Always, unless overridden by a subclass.
   */
  async send(target, code) {
    throw new Error('send() not implemented');
  }
}

module.exports = OtpProvider;
