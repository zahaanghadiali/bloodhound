/**
 * Sends one chat message to the mock channel endpoint.
 * @param {{externalUserId: string, text: (string|undefined), payload: *,
 *     location: ?Object, attachment: ?Object}} message Message in the same
 *     shape a real channel webhook is normalized to.
 * @return {Promise<Array<Object>>} The bot's replies, in order.
 * @throws {Error} If the response status is not 2xx.
 */
export async function postIncoming({ externalUserId, text = '', payload = null, location = null, attachment = null }) {
  const res = await fetch('/api/mock/incoming', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalUserId, text, payload, location, attachment }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Something went wrong. Please try again.');
  }

  const data = await res.json();
  return data.replies || [];
}
