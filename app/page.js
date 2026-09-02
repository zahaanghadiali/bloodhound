export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '80px auto', padding: '0 24px' }}>
      <h1>🐾 Bloodhound</h1>
      <p>Backend and API are live. Frontend build starts here.</p>
      <p>
        Try it: <code>POST /api/mock/incoming</code> with <code>{'{"externalUserId":"test","text":"hi"}'}</code>
      </p>
    </main>
  );
}
