# Bloodhound

A Next.js app (API + frontend, one deploy on Vercel) for a WhatsApp/Instagram chatbot that matches pet owners needing blood donors with registered donor pets nearby. The conversation engine, data layer, and APIs work today with no WhatsApp/Instagram API keys required — those channels plug in later without touching the core logic.

## How it's structured

- `app/api/**/route.js` — the HTTP layer (Next.js App Router route handlers). Thin: parse the request, call into `lib/`, shape the response.
- `app/page.js` / `app/layout.js` — the frontend, starting point for the website you'll build on top of the same API/DB.
- `lib/engine/` — the channel-agnostic conversation engine. Flows are declarative step lists (`lib/flows/`); the engine validates input per step type (`stepTypes.js`), tracks history for "back", and recognizes global commands (`globalCommands.js`) like `back`, `restart`, `cancel`, `pause`, `resume`, `delete` that work at any point in any flow.
- `lib/channels/` — one adapter per channel, all implementing the same `normalizeIncoming` / `send` interface (`adapterInterface.js`):
  - `mockAdapter.js` — no external service, used by `/api/mock/incoming` for local testing.
  - `whatsappAdapter.js` / `instagramAdapter.js` — written against Meta's real webhook payload shapes and Graph API send calls. They no-op (log + skip) until `.env` has real credentials, so nothing breaks today.
- `lib/services/messageProcessor.js` — the orchestrator: loads/creates a `Conversation`, checks global commands, drives the active flow, and on completion persists to MongoDB (`PetParent`/`Pet`) or runs a donor search.
- `lib/models/` — Mongoose schemas (`Conversation`, `PetParent`, `Pet`), with a `2dsphere` index on `Pet.location` for geo donor search.
- `lib/config/db.js` — MongoDB connection, cached on `global` so warm serverless invocations reuse it instead of exhausting the connection pool (see "Deploying to Vercel" below).

All conversation state lives in MongoDB, not in memory, so the app is stateless and can run as multiple serverless instances.

**WhatsApp/Instagram share the same database and flows as everything else** — `messageProcessor.js` doesn't know which channel it's talking to, so registering a donor over WhatsApp, Instagram, or the mock endpoint all write to the same `PetParent`/`Pet` collections and are matchable by any channel's donor search.

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/webhooks/whatsapp` | Meta webhook verification + inbound messages |
| GET/POST | `/api/webhooks/instagram` | Same, for Instagram Messaging API |
| POST | `/api/mock/incoming` | Simulate an inbound chat message — **use this to test every flow step today** |
| GET | `/api/donors/search` | `?species=dog&lat=&lng=&radiusKm=` or `?species=dog&city=` |
| GET/POST | `/api/pets`, `/api/pets/:id` (PATCH) | Pet CRUD |
| GET/POST | `/api/pet-parents`, `/api/pet-parents/:id` (PATCH) | Pet parent CRUD |
| GET | `/api/conversations/:id` | Inspect a conversation |
| POST | `/api/conversations/:id/pause` \| `/resume` \| `/delete` | Account-level donor controls |
| GET | `/api/health` | Health check |

## Running locally

Requires **Node 22+** (LTS) — see `.nvmrc`. If you use nvm: `nvm use`.

```bash
npm install
cp .env.example .env.local   # point MONGODB_URI at a local/Atlas instance
npm run dev
```

### Try a full conversation without any API keys

```bash
curl -s localhost:3000/api/mock/incoming -H 'content-type: application/json' \
  -d '{"externalUserId":"test-user","text":"hi"}' | jq

curl -s localhost:3000/api/mock/incoming -H 'content-type: application/json' \
  -d '{"externalUserId":"test-user","text":"register"}' | jq

curl -s localhost:3000/api/mock/incoming -H 'content-type: application/json' \
  -d '{"externalUserId":"test-user","text":"dog"}' | jq
# ...continue answering each prompt in `replies[].text`
```

A location step accepts either free text (`"text":"Churchgate"`) or a real share (`"location":{"lat":18.93,"lng":72.82,"label":"Churchgate"}`).

Mid-flow, send `"back"` to redo the last answer, `"restart"` for the main menu, `"pause"`/`"resume"`/`"delete"` to manage an existing donor profile — these work at any step.

## Wiring up real channels later

Fill in `WHATSAPP_*` / `INSTAGRAM_*` values in `.env.local` (access token, phone number ID, verify token, app secret for webhook signature validation). No code changes needed — the webhook route handlers already validate signatures when a secret is present, and the adapters already call the real Graph API endpoints.

## Deploying to Vercel

- Set the same env vars from `.env.example` in the Vercel project settings (`MONGODB_URI` at minimum — use an Atlas connection string, not `localhost`).
- MongoDB connections are cached per serverless instance (`lib/config/db.js`) to avoid connection-pool exhaustion across invocations — no extra setup needed, just make sure `MONGODB_URI` is set.
- Point the Meta webhook URLs (WhatsApp/Instagram App dashboard) at `https://<your-domain>/api/webhooks/whatsapp` and `/api/webhooks/instagram` once deployed.
