# Bloodhound

Backend for a WhatsApp/Instagram chatbot that matches pet owners needing blood donors with registered donor pets nearby. Built so the conversation engine, data layer, and APIs work today, with no WhatsApp/Instagram API keys required — those channels plug in later without touching the core logic.

## How it's structured

- `src/engine/` — the channel-agnostic conversation engine. Flows are declarative step lists (`src/flows/`); the engine validates input per step type (`stepTypes.js`), tracks history for "back", and recognizes global commands (`globalCommands.js`) like `back`, `restart`, `cancel`, `pause`, `resume`, `delete` that work at any point in any flow.
- `src/channels/` — one adapter per channel, all implementing the same `normalizeIncoming` / `send` interface (`adapterInterface.js`):
  - `mockAdapter.js` — no external service, used by `/api/mock/incoming` for local testing.
  - `whatsappAdapter.js` / `instagramAdapter.js` — written against Meta's real webhook payload shapes and Graph API send calls. They no-op (log + skip) until `.env` has real credentials, so nothing breaks today.
- `src/services/messageProcessor.js` — the orchestrator: loads/creates a `Conversation`, checks global commands, drives the active flow, and on completion persists to MongoDB (`PetParent`/`Pet`) or runs a donor search.
- `src/models/` — Mongoose schemas (`Conversation`, `PetParent`, `Pet`), with a `2dsphere` index on `Pet.location` for geo donor search.
- `src/routes/` + `src/controllers/` — REST layer (see below).

All conversation state lives in MongoDB, not in memory, so the server is stateless and can run as multiple instances behind a load balancer.

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/webhooks/whatsapp` | Meta webhook verification + inbound messages |
| GET/POST | `/webhooks/instagram` | Same, for Instagram Messaging API |
| POST | `/api/mock/incoming` | Simulate an inbound chat message — **use this to test every flow step today** |
| GET | `/api/donors/search` | `?species=dog&lat=&lng=&radiusKm=` or `?species=dog&city=` |
| GET/POST | `/api/pets`, `/api/pets/:id` (PATCH) | Pet CRUD |
| GET/POST | `/api/pet-parents`, `/api/pet-parents/:id` (PATCH) | Pet parent CRUD |
| GET | `/api/conversations/:id` | Inspect a conversation |
| POST | `/api/conversations/:id/pause` \| `/resume` \| `/delete` | Account-level donor controls |
| GET | `/health` | Health check |

## Running locally

```bash
npm install
cp .env.example .env   # point MONGODB_URI at a local/Atlas instance
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

Fill in `WHATSAPP_*` / `INSTAGRAM_*` values in `.env` (access token, phone number ID, verify token, app secret for webhook signature validation). No code changes needed — `webhookController.js` already validates signatures when a secret is present, and the adapters already call the real Graph API endpoints.
