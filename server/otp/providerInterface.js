/**
 * Contract every OTP delivery provider must implement — one send-a-code
 * method, channel-agnostic (SMS or email), mirroring the ChannelAdapter
 * pattern in api/channels/.
 *
 * send(target, code) -> Promise<void>, target is a phone number or email.
 */
class OtpProvider {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async send(target, code) {
    throw new Error('send() not implemented');
  }
}

module.exports = OtpProvider;
