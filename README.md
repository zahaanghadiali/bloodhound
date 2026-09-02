# Bloodhound

A Next.js app (API + frontend, one deploy on Vercel) for a WhatsApp/Instagram chatbot that matches pet owners needing blood donors with registered donor pets nearby. The conversation engine, data layer, and APIs work today with no WhatsApp/Instagram API keys required — those channels plug in later without touching the core logic.

## How it's structured

Three top-level folders, each with one job:

- **`app/`** — routing only. `app/api/[...path]/route.js` is the *only* route file in the whole app; every `/api/*` request lands there and gets dispatched by `server/router.js` to a controller. `app/page.js` / `app/layout.js` mount the chat frontend.
- **`server/`** — all backend logic, framework-agnostic below the router:
  - `server/router.js` — the route table (`method` + path pattern → controller function).
  - `server/controllers/` — one file per resource (`mockController`, `conversationsController`, `donorsController`, `petsController`, `petParentsController`, `webhooksController`, `geoController`, `healthController`). Thin: parse the request, call a service, shape the response.
  - `server/engine/` — the channel-agnostic conversation engine. Flows are declarative step lists (`server/flows/`); the engine validates input per step type (`stepTypes.js`), tracks history for "back", and recognizes global commands (`globalCommands.js`) like `back`, `restart`, `cancel`, `pause`, `resume`, `delete` that work at any point in any flow.
  - `server/channels/` — one adapter per channel, all implementing the same `normalizeIncoming` / `send` interface (`adapterInterface.js`):
    - `mockAdapter.js` — no external service, used by `/api/mock/incoming` for local testing.
    - `whatsappAdapter.js` / `instagramAdapter.js` — written against Meta's real webhook payload shapes and Graph API send calls. They no-op (log + skip) until `.env` has real credentials, so nothing breaks today.
  - `server/services/messageProcessor.js` — the orchestrator: loads/creates a `Conversation`, checks global commands, drives the active flow, and on completion persists to MongoDB (`PetParent`/`Pet`) or runs a donor search.
  - `server/services/otpService.js` + `server/otp/` — phone/email verification (see below).
  - `server/services/geoService.js` — country/city → coordinates lookup for the location picker (see below).
  - `server/models/` — Mongoose schemas (`Conversation`, `PetParent`, `Pet`, `OtpChallenge`), with a `2dsphere` index on `Pet.location` for geo donor search.
  - `server/config/db.js` — MongoDB connection, cached on `global` so warm serverless invocations reuse it instead of exhausting the connection pool (see "Deploying to Vercel" below).
- **`components/` / `styles/`** — the chat frontend. `components/chat/lib/` holds its client-side state (the `useChat` hook, the `/api/mock/incoming` client) — frontend-only, kept separate from `server/`. `styles/theme.css` is the single file to edit for global re-theming.

All conversation state lives in MongoDB, not in memory, so the app is stateless and can run as multiple serverless instances.

**WhatsApp/Instagram share the same database and flows as everything else** — `messageProcessor.js` doesn't know which channel it's talking to, so registering a donor over WhatsApp, Instagram, or the mock endpoint all write to the same `PetParent`/`Pet` collections and are matchable by any channel's donor search.

### Phone/email OTP verification

The `registerDonor` flow verifies both `parentPhone` and `parentEmail` with a 6-digit code before moving on (see `server/flows/registerDonorFlow.js`, `server/services/otpService.js`). Delivery is pluggable via `OTP_SMS_PROVIDER` / `OTP_EMAIL_PROVIDER` in `.env`:

- **`mock` (default) — no API keys needed.** The code is echoed straight into the chat reply as "🧪 Dev mode — your code is ######", so the whole flow is testable today.
- **`twilio`** (SMS) — needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- **`resend`** (email) — needs `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`.

Typing `"resend"` at the code prompt issues a new code (rate-limited to one per 30s); 5 wrong attempts requires a resend.

### Location: share GPS or pick country/city

The location step accepts a browser geolocation share, or a country + city picked from `/api/geo/countries` and `/api/geo/cities?country=..&q=..` — backed by the bundled `all-the-cities` dataset (135k+ cities with coordinates, MIT licensed). **No API key or geocoding service required.**

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
| GET | `/api/geo/countries` | Country list for the manual location picker |
| GET | `/api/geo/cities` | `?country=IN&q=mum` — matching cities with lat/lng |
| GET | `/api/health` | Health check |

Every row above is one entry in `server/router.js`'s route table, not a separate `route.js` file — see "How it's structured".

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
