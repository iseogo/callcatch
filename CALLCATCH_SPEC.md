# CALLCATCH — 24/7 AI Receptionist for Home Services (PRD for Cursor)

**Product:** CallCatch — 24/7 AI receptionist for small trades businesses (plumbing, HVAC, electrical) with 1–10 technicians. Answers every call, qualifies urgency, books the job, notifies the owner by SMS.
**Customer:** the business owner directly. Local sales (Omaha/Midwest). $299–399/mo flat.
**Brand:** CallCatch (domain: callcatch.com / callcatch.ai). Tagline: "Never lose a job to voicemail again."
**Starting point:** new lightweight repo named `callcatch`. Copy only the useful modules from SmartDesk Dental (Retell client, SignalWire client, SMS engine with conversation history, safe JSON-parse utility). No complex multi-tenancy: a flat `Business` model.
**Timeline:** 10 days.

---

## 1. Deliberately minimal scope

ONE inbound agent per business. No sub-accounts, no white-label, no complex dashboard. The product is: the phone gets answered, the job gets booked, the owner gets an SMS. Period.

## 2. Data model (Prisma)

```prisma
model Business {
  id             String  @id @default(cuid())
  name           String  // "Bob's Plumbing"
  ownerPhone     String  // SMS notifications + emergency escalation
  onCallPhone    String? // live transfer for after-hours emergencies
  trade          Trade   // PLUMBING | HVAC | ELECTRICAL | OTHER
  timezone       String
  businessHours  Json    // { mon: ["7:00","17:00"], ... }
  serviceArea    Json    // zip codes or mile radius
  services       Json    // [{ name: "Water heater repair", durationMin: 90 }, ...]
  phoneNumber    String? // SignalWire
  retellAgentId  String?
  calendarType   CalType // GOOGLE | JOBBER | HOUSECALL_PRO
  calendarConfig Json
  status         Status  // TRIAL | ACTIVE | PAUSED
  stripeCustomerId String?
}

model Call {
  id, businessId, callerPhone, startedAt, durationSec,
  intent      Intent   // EMERGENCY | SERVICE_REQUEST | QUOTE | RESCHEDULE | OTHER
  outcome     Outcome  // BOOKED | TRANSFERRED | MESSAGE_TAKEN | MISSED_INFO
  transcript, summary, jobValueEstimate Float?
}

model Booking { id, businessId, callId, customerName, customerPhone, address, issue, scheduledAt, confirmed Boolean }
model SmsThread { ... }  // copied from the dental engine, keyed (businessId, callerPhone)
```

## 3. The agent (the core — 2 days of prompt work)

**Inbound flow:**
1. Greeting with the business name ("Thanks for calling Bob's Plumbing!")
2. **Emergency detection:** active leak, no heat below 32°F, gas smell (→ "call 911 / the gas company" first), total power outage
3. Qualification: problem, address (**check service area** — out of area = polite message + SMS to owner), name, callback number
4. **If emergency + after hours:** attempt live transfer to `onCallPhone` (SignalWire dial). If it fails → book first morning slot + immediate SMS to owner with 🚨
5. **If routine:** offer 2–3 slots from the calendar → book → SMS confirmation to the customer
6. End of call → Retell post-call webhook: summary, intent, outcome, estimated job value → SMS to owner ("✅ Job booked: water heater, 123 Main St, tomorrow 8am — ~$450")

**Important prompt rules:**
- Never quote firm prices — ranges only if the owner configured them, otherwise "the technician will confirm pricing on site"
- Tone: direct, warm, not corporate (like a good dispatcher, not a call center)
- Always strip markdown fences before JSON.parse (SmartDesk lesson)

## 4. Calendar integrations

- **v1: Google Calendar** (FreeBusy + insert event) — most small trades businesses only have this
- **v1.5: Jobber** then **Housecall Pro** (simple REST APIs, OAuth) — strong sales argument
- Slot duration = `services[].durationMin` + 30-min travel buffer

## 5. Owner dashboard (minimal)

One page: calls today/this week, bookings, missed calls recovered, estimated pipeline value. One settings page: hours, services, service area, on-call number. That's it. The owner lives on their phone — SMS is the real interface.

## 6. Billing

Stripe Checkout, one price: $299/mo (or $399 with Jobber/HCP). 30-day trial with a "5 jobs recovered or your money back" guarantee. No metered billing in v1 — flat, simple, sellable in person.

## 7. Sprints

### Sprint 1 (Days 1–5)
- [ ] Repo + schema + copy Retell/SignalWire/SMS modules from dental
- [ ] Trades agent prompt + emergency/escalation/transfer logic
- [ ] Google Calendar booking + SMS confirmations
- [ ] Provisioning: `POST /api/businesses` → number + agent in one command
- **Exit:** your own test number answers, books, notifies. You can do live demos.

### Sprint 2 (Days 6–10)
- [ ] Minimal owner dashboard + settings page
- [ ] Stripe + trial flow
- [ ] CallCatch landing page — hero: "Never lose a job to voicemail again" (EN first, FR second)
- [ ] Post-call QA: flag failed calls for prompt improvement
- **Exit:** 3 local pilots signed. Jobber/HCP in week 3 if pilots ask for it.

## 8. Non-goals v1
Outbound campaigns, multi-agents, white-label, mobile app, self-serve signup (in-person sales first), ServiceTitan (that's Avoca's territory — stay below it).

## 9. Go-to-market reminder
Supply houses in the morning, chamber of commerce, BNI, the Saturday-night call test ("you just lost this customer — never again"). 90-day goal: 8–10 customers = ~$2.5–4K MRR.
