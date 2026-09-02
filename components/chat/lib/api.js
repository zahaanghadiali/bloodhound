/**
 * Talks to the "mock" channel adapter — the same normalized shape a real
 * WhatsApp/Instagram webhook would produce, so swapping channels later
 * doesn't touch this frontend.
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
