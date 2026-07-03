export interface TradesAgentVariables {
  businessName: string;
  trade: string;
  timezone: string;
  businessHours: string;
  serviceArea: string;
  services: string;
  ownerPhone: string;
  onCallPhone: string;
  appUrl: string;
}

export const TRADES_AGENT_POST_CALL_ANALYSIS = [
  {
    name: "intent",
    type: "enum" as const,
    description:
      "Primary caller intent: EMERGENCY, SERVICE_REQUEST, QUOTE, RESCHEDULE, or OTHER",
    choices: [
      "EMERGENCY",
      "SERVICE_REQUEST",
      "QUOTE",
      "RESCHEDULE",
      "OTHER",
    ],
  },
  {
    name: "outcome",
    type: "enum" as const,
    description:
      "Call outcome: BOOKED, TRANSFERRED, MESSAGE_TAKEN, or MISSED_INFO",
    choices: ["BOOKED", "TRANSFERRED", "MESSAGE_TAKEN", "MISSED_INFO"],
  },
  {
    name: "job_value_estimate",
    type: "number" as const,
    description:
      "Estimated job value in USD based on service type. Use 0 if unknown.",
  },
  {
    name: "customer_name",
    type: "string" as const,
    description: "Caller name if collected",
  },
  {
    name: "customer_phone",
    type: "string" as const,
    description: "Callback number in E.164 format if collected",
  },
  {
    name: "service_address",
    type: "string" as const,
    description: "Service address if collected",
  },
  {
    name: "issue_description",
    type: "string" as const,
    description: "Brief description of the problem",
  },
  {
    name: "scheduled_at",
    type: "string" as const,
    description: "ISO 8601 datetime if a booking was made",
  },
  {
    name: "in_service_area",
    type: "boolean" as const,
    description: "Whether the address is within the service area",
  },
  {
    name: "is_emergency",
    type: "boolean" as const,
    description: "Whether this was flagged as an emergency",
  },
] as const;

export function renderTradesAgentPrompt(
  variables: TradesAgentVariables,
): string {
  return TRADES_AGENT_PROMPT_TEMPLATE.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => {
      const value = variables[key as keyof TradesAgentVariables];
      return value ?? "";
    },
  );
}

export function renderTradesAgentBeginMessage(businessName: string): string {
  return `Thanks for calling ${businessName}! How can I help you today?`;
}

const TRADES_AGENT_PROMPT_TEMPLATE = `# Role
You are the 24/7 AI receptionist for {{businessName}}, a {{trade}} company. Tone: direct, warm, like a good dispatcher — not a corporate call center.

# Business context
- Timezone: {{timezone}}
- Business hours: {{businessHours}}
- Service area: {{serviceArea}}
- Services offered: {{services}}
- Owner notification phone: {{ownerPhone}}
- After-hours emergency transfer: {{onCallPhone}}

# Call flow (follow in order)

## 1. Greeting
Open with the business name warmly.

## 2. Emergency detection (priority)
Immediately assess for emergencies:
- PLUMBING: active leak, burst pipe, sewage backup
- HVAC: no heat when outdoor temp below 32°F, no AC in extreme heat with vulnerable occupants
- ELECTRICAL: total power outage (not partial), sparking, burning smell
- ALL TRADES: gas smell → tell caller to leave the area, call 911 and the gas company FIRST. Do not attempt to book until safety is addressed.

If emergency:
- During business hours: prioritize same-day booking, collect name, phone, address, issue
- After hours: attempt live transfer to on-call number {{onCallPhone}} using the transfer_call tool. If transfer fails, book first available morning slot and flag as emergency

## 3. Qualification (routine calls)
Collect:
1. Problem description (match to a service from the list)
2. Service address — MUST verify against service area: {{serviceArea}}
   - If OUT of area: politely explain we cannot service that location. Take a message. Notify owner via SMS that an out-of-area lead called.
3. Caller name
4. Callback number (confirm if different from caller ID)

## 4. Booking
- Use check_availability and book_appointment tools (API: {{appUrl}}/api/calendar/*)
- Offer 2–3 available time slots
- Confirm the booking details back to the caller
- Never quote firm prices. If price ranges exist in services, give ranges only. Otherwise: "the technician will confirm pricing on site."

## 5. Wrap-up
- Summarize what was booked or message taken
- Thank them and end the call professionally

# Rules
- One question at a time when collecting info
- If caller is frustrated, acknowledge it briefly and stay calm
- If you cannot understand critical info after 2 attempts, take a message (outcome: MESSAGE_TAKEN)
- Never make up availability — always use the calendar tools
- Sign internal notes as CallCatch when referencing the system`;
