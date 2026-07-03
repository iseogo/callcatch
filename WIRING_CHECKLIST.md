# CallCatch Wiring Checklist

Complete these steps in order to go from local mock mode to a live demo number that answers, books, and texts the owner.

---

## Current status (2026-07-02)

| Item | Status |
|------|--------|
| Env vars in `.env.local` | Filled (live keys) |
| `MOCK_MODE` | **`true`** — local dev without real telephony until migration + webhooks |
| Prisma migration | **Blocked** — Supabase outage / auth; run when service recovers |
| Retell API | Verified — `list-agents` OK |
| SignalWire API | Verified — available numbers OK (`SIGNALWIRE_SPACE_URL` must include `https://`) |
| Google FreeBusy | Needs per-business `refreshToken` in `calendarConfig` |
| SIP trunk creds | Replace placeholders before live provisioning |
| App dev server | `npm run dev` → `http://localhost:3000` OK in mock mode |

**When Supabase recovers:**

```bash
# Prisma reads .env (not .env.local) — keep DATABASE_URL + DIRECT_URL in sync
npx prisma migrate dev
# or for production deploy:
npx prisma migrate deploy
```

Migration file: `prisma/migrations/20260702111417_init/migration.sql`

---

## 1. Environment variables

### Two env files (important)

| File | Used by | Gitignored |
|------|---------|------------|
| `.env.local` | **Next.js** (all app vars) | Yes |
| `.env` | **Prisma CLI** (`migrate`, `studio`) | Yes |

Copy `.env.example` → `.env.local` and fill every value. Then copy **only** `DATABASE_URL` and `DIRECT_URL` into `.env` for Prisma.

### All variables

| Variable | Required when | Where to get it |
|----------|---------------|-----------------|
| `DATABASE_URL` | Always | [Supabase](https://supabase.com/dashboard) → Project → **Settings** → **Database** → **Connection string** → **Transaction pooler** (port **6543**, `?pgbouncer=true`) |
| `DIRECT_URL` | Prisma migrations | Same page → **Session pooler** (port **5432**) or **Direct connection** — use for `prisma migrate dev` |
| `NEXT_PUBLIC_APP_URL` | Always | Deployed URL (e.g. `https://callcatch.vercel.app`) or `http://localhost:3000` for local-only mock |
| `MOCK_MODE` | Dev | `true` = mock Retell/SignalWire/Calendar; `false` = live integrations |
| `SKIP_ENV_VALIDATION` | Dev only | `true` locally; **`false` in production** |
| `RETELL_API_KEY` | Live voice | [Retell Dashboard](https://dashboard.retellai.com/) → **API Keys** |
| `SIGNALWIRE_PROJECT_ID` | Live telephony/SMS | [SignalWire](https://signalwire.com/signin) → Space → **API** → Project ID |
| `SIGNALWIRE_API_TOKEN` | Live telephony/SMS | Same page → create API token (scopes: **Numbers**, **Messaging**) |
| `SIGNALWIRE_SPACE_URL` | Live telephony/SMS | Space URL with scheme: `https://your-space.signalwire.com` |
| `SIGNALWIRE_SIP_TERMINATION_URI` | Retell ↔ SignalWire SIP | SignalWire → **Relay** → SIP → Termination URI (e.g. `your-space.pstn.signalwire.com`) |
| `SIGNALWIRE_SIP_USERNAME` | SIP auth | SignalWire SIP trunk credentials |
| `SIGNALWIRE_SIP_PASSWORD` | SIP auth | SignalWire SIP trunk credentials |
| `GOOGLE_CLIENT_ID` | Calendar booking | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID (Web) |
| `GOOGLE_CLIENT_SECRET` | Calendar booking | Same OAuth client |
| `GOOGLE_REDIRECT_URI` | Calendar OAuth | `{NEXT_PUBLIC_APP_URL}/api/auth/google/callback` (add to authorized redirect URIs) |
| `PROVISIONING_SECRET` | Protect provisioning API | Long random string; send as `Authorization: Bearer <secret>` |

**Optional (smoke tests only, not in `env.ts`):**

| Variable | Purpose |
|----------|---------|
| `GOOGLE_TEST_REFRESH_TOKEN` | Run FreeBusy integration test without provisioning a business |

**Per-business Google tokens** (not env vars) — stored in `Business.calendarConfig` at provisioning:

```json
{
  "calendarId": "primary",
  "refreshToken": "<oauth_refresh_token>"
}
```

Obtain the refresh token via Google OAuth consent flow for scope `https://www.googleapis.com/auth/calendar`.

---

## 2. Database

```bash
# After Supabase is healthy — sync .env from .env.local first
npx prisma migrate dev
```

For Vercel/production deploys:

```bash
npx prisma migrate deploy
```

---

## 3. Deploy the app (webhooks need a public URL)

### Recommendation

| Scenario | Use |
|----------|-----|
| **Demo / staging / production** | **[Vercel](https://vercel.com)** — stable HTTPS URL, no tunnel to babysit |
| **Local webhook debugging only** | **[ngrok](https://ngrok.com)** or Cloudflare Tunnel — temporary public URL pointing at `localhost:3000` |

**Use Vercel** for the real end-to-end call test. Webhooks from Retell and SignalWire must reach your app over HTTPS; `http://localhost:3000` only works if you run a tunnel and set `NEXT_PUBLIC_APP_URL` to the tunnel URL.

### Vercel setup

1. Connect repo → deploy
2. **Settings → Environment Variables** — copy all vars from `.env.local` (production + preview)
3. Set `MOCK_MODE=false`, `SKIP_ENV_VALIDATION=false`
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain (e.g. `https://callcatch.vercel.app`)
5. Update `GOOGLE_REDIRECT_URI` to match the deployed callback URL
6. Run `npx prisma migrate deploy` against production `DATABASE_URL` (CI step or locally)

### Local + tunnel (optional)

```bash
ngrok http 3000
# Set NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
npm run dev
```

Verify health:

```bash
curl https://YOUR_APP_URL/
```

---

## 4. Retell dashboard — webhook URLs

Replace `YOUR_APP_URL` with `NEXT_PUBLIC_APP_URL` (no trailing slash).

Provisioning (`POST /api/businesses`) sets these automatically. Paste manually if reconfiguring.

### 4a. Agent webhook (post-call events)

**Dashboard:** [Retell](https://dashboard.retellai.com/) → **Agents** → your agent → **Webhook URL**

```
https://YOUR_APP_URL/api/webhooks/retell
```

Events: `call_started`, `call_ended`, `call_analyzed`

### 4b. Inbound call webhook (per phone number)

**Dashboard:** Retell → **Phone Numbers** → your number → **Inbound Webhook URL**

```
https://YOUR_APP_URL/api/webhooks/retell/inbound
```

Returns dynamic variables (`businessId`) and agent overrides per inbound call.

### 4c. Post-call analysis fields

Configured on the LLM via provisioning: `intent`, `outcome`, `job_value_estimate`, booking fields. Verify under agent → **Post-Call Analysis**.

---

## 5. SignalWire dashboard — webhook URLs

Replace `YOUR_APP_URL` with `NEXT_PUBLIC_APP_URL`.

Provisioning sets SMS webhook on purchase. Paste manually if reconfiguring.

### 5a. Inbound SMS

**Dashboard:** SignalWire → **Phone Numbers** → your number → **Messaging** → Request URL

```
https://YOUR_APP_URL/api/webhooks/signalwire/sms
```

Method: **POST**

### 5b. SIP origination (inbound voice → Retell)

In SignalWire, configure SIP trunk **origination** to route inbound calls to Retell:

| Setting | Value |
|---------|-------|
| SIP URI | `sip:sip.retellai.com;transport=tcp` |
| IP whitelist (Retell) | `18.98.16.120/30`, `143.223.88.0/21`, `161.115.160.0/19` |

Then import the number into Retell (provisioning calls `POST /import-phone-number` with your SIP termination URI + credentials).

### 5c. Emergency live transfer (LaML)

Used when after-hours emergency transfer is initiated:

```
https://YOUR_APP_URL/api/webhooks/signalwire/transfer?to=<onCallPhone>
```

Configured dynamically in `lib/signalwire.ts` when `initiateLiveTransfer()` runs.

---

## 6. Google Calendar

1. Enable **Google Calendar API** in Google Cloud Console
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
4. Complete OAuth for the business owner's Google account
5. Store `refreshToken` + `calendarId` in `calendarConfig` when provisioning

Agent tool endpoints (called by Retell during live calls):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/calendar/slots` | FreeBusy → return 2–3 open slots |
| `POST /api/calendar/book` | Insert event + SMS confirmation to customer |

---

## 7. Provision a business

Requires migration applied and `MOCK_MODE=false` for real phone/agent setup.

```bash
curl -X POST https://YOUR_APP_URL/api/businesses \
  -H "Authorization: Bearer YOUR_PROVISIONING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob'\''s Plumbing",
    "ownerPhone": "+14025559876",
    "onCallPhone": "+14025551111",
    "trade": "PLUMBING",
    "timezone": "America/Chicago",
    "voiceId": "11labs-Adrian",
    "businessHours": {
      "mon": ["07:00", "17:00"],
      "tue": ["07:00", "17:00"],
      "wed": ["07:00", "17:00"],
      "thu": ["07:00", "17:00"],
      "fri": ["07:00", "17:00"],
      "sat": null,
      "sun": null
    },
    "serviceArea": { "type": "zip_codes", "zipCodes": ["68102", "68104", "68105"] },
    "services": [{ "name": "Water heater repair", "durationMin": 90, "priceRangeMin": 350, "priceRangeMax": 600 }],
    "calendarType": "GOOGLE",
    "calendarConfig": { "calendarId": "primary", "refreshToken": "YOUR_GOOGLE_REFRESH_TOKEN" },
    "desiredPhoneNumber": "+14025550123"
  }'
```

In **mock mode**, `desiredPhoneNumber` is optional (defaults to `+14025550100`).

Response includes `businessId`, `phoneNumber`, `retellAgentId`.

---

## 8. End-to-end test procedure

### Phase A — Mock mode (now, no Supabase migration required for simulate-call if DB reachable)

**Setup:**

```bash
# .env.local
MOCK_MODE=true
SKIP_ENV_VALIDATION=true
DATABASE_URL=...   # still needed for Prisma client if DB is up
```

```bash
npm run dev
# → http://localhost:3000
```

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | `GET http://localhost:3000/` | 200, app loads |
| 2 | Provision mock business (see curl below) | 201 with `businessId`, mock `retellAgentId` |
| 3 | `POST /api/dev/simulate-call` with `businessId` | 200, mock post-call pipeline runs |
| 4 | Check terminal logs | `[MOCK SMS]` owner notification with `— CallCatch` |
| 5 | `npx prisma studio` | `Call` + `Booking` rows created |

**Provision (mock — no Bearer required if `PROVISIONING_SECRET` unset):**

```bash
curl -X POST http://localhost:3000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob'\''s Plumbing",
    "ownerPhone": "+14025559876",
    "trade": "PLUMBING",
    "timezone": "America/Chicago",
    "voiceId": "11labs-Adrian",
    "businessHours": {
      "mon": ["07:00", "17:00"],
      "tue": ["07:00", "17:00"],
      "wed": ["07:00", "17:00"],
      "thu": ["07:00", "17:00"],
      "fri": ["07:00", "17:00"],
      "sat": null,
      "sun": null
    },
    "serviceArea": { "type": "zip_codes", "zipCodes": ["68102"] },
    "services": [{ "name": "Water heater repair", "durationMin": 90 }],
    "calendarType": "GOOGLE",
    "calendarConfig": { "calendarId": "primary", "refreshToken": "mock_refresh" }
  }'
```

**Simulate post-call:**

```bash
curl -X POST http://localhost:3000/api/dev/simulate-call \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "YOUR_BUSINESS_ID",
    "callerPhone": "+14025551234",
    "issue": "water heater not working",
    "address": "123 Main St, Omaha NE",
    "customerName": "Jane Doe"
  }'
```

---

### Phase B — Live end-to-end (after Supabase migration + Vercel deploy)

**Prerequisites:** Sections 1–7 complete, `MOCK_MODE=false`, webhooks configured, SIP creds real.

| # | Action | Expected result |
|---|--------|-----------------|
| 1 | Call the provisioned `phoneNumber` from your cell | Retell agent answers: "Thanks for calling Bob's Plumbing!" |
| 2 | Describe a routine issue (e.g. "water heater not working") | Agent qualifies: problem, address, name, callback |
| 3 | Accept an offered time slot | Agent confirms booking |
| 4 | Hang up | Retell sends `call_analyzed` webhook to `/api/webhooks/retell` |
| 5 | Check owner phone SMS | `✅ Job booked: …` + `— CallCatch` |
| 6 | Check customer phone SMS | Appointment confirmation with date/time |
| 7 | Check Google Calendar | New event at booked time |
| 8 | Check DB (`prisma studio`) | `Call` row with intent/outcome/summary; `Booking` row |

**Emergency after-hours test:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Call outside business hours | Agent detects after-hours |
| 2 | Describe emergency (active leak) | Agent attempts transfer to `onCallPhone` |
| 3 | If transfer fails | Books first morning slot |
| 4 | Owner SMS | `🚨` prefix with caller details |

---

## 9. Webhook URL summary

Replace `YOUR_APP_URL` with your deployed `NEXT_PUBLIC_APP_URL`.

| Service | Full URL | Method | Set in |
|---------|----------|--------|--------|
| Retell agent events | `https://YOUR_APP_URL/api/webhooks/retell` | POST | Retell → Agent → Webhook URL |
| Retell inbound call | `https://YOUR_APP_URL/api/webhooks/retell/inbound` | POST | Retell → Phone Number → Inbound Webhook |
| SignalWire inbound SMS | `https://YOUR_APP_URL/api/webhooks/signalwire/sms` | POST | SignalWire → Phone Number → Messaging URL |
| SignalWire transfer LaML | `https://YOUR_APP_URL/api/webhooks/signalwire/transfer?to=<E164>` | POST | Dynamic (emergency transfer) |

Retell agent tools (called mid-call, not dashboard webhooks):

| Tool | URL |
|------|-----|
| Check availability | `https://YOUR_APP_URL/api/calendar/slots` |
| Book appointment | `https://YOUR_APP_URL/api/calendar/book` |

---

## 10. Verify build

```bash
npm run typecheck
npx prisma validate
node scripts/verify-integrations.mjs   # live API smoke test (optional)
```

Integration smoke test (Retell list agents, SignalWire available numbers, Google FreeBusy if refresh token set):

```bash
node scripts/verify-integrations.mjs
```
