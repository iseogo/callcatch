import type { Business, Intent, Outcome } from "@prisma/client";
import { env, requireLiveCredentials } from "@/env";
import {
  BusinessHoursSchema,
  GoogleCalendarConfigSchema,
} from "@/lib/business-schemas";
import { GoogleCalendarError } from "@/lib/errors";
import { withRetry } from "@/lib/retry";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingEventInput {
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  attendeeEmail?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

interface FreeBusyResponse {
  calendars: Record<
    string,
    {
      busy: Array<{ start: string; end: string }>;
    }
  >;
}

interface EventInsertResponse {
  id: string;
  htmlLink?: string;
}

async function getAccessToken(
  config: ReturnType<typeof GoogleCalendarConfigSchema.parse>,
): Promise<string> {
  if (
    config.accessToken &&
    config.tokenExpiresAt &&
    config.tokenExpiresAt > Date.now() + 60_000
  ) {
    return config.accessToken;
  }

  if (env.MOCK_MODE) {
    return "mock_access_token";
  }

  requireLiveCredentials("google");

  const response = await withRetry(async () => {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new GoogleCalendarError(
        `Google token refresh failed: ${res.status} ${text}`,
        res.status,
      );
    }

    return res;
  });

  const data = (await response.json()) as GoogleTokenResponse;
  return data.access_token;
}

function parseCalendarConfig(business: Business) {
  return GoogleCalendarConfigSchema.parse(business.calendarConfig);
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

const WEEKDAY_KEYS: Record<string, string> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

function getLocalSchedulePosition(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: WEEKDAY_KEYS[values.weekday ?? ""] ?? "",
    minuteOfDay:
      Number(values.hour ?? "0") * 60 + Number(values.minute ?? "0"),
  };
}

function parseTimeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function generateMockSlots(
  timeMin: string,
  timeMax: string,
  durationMin: number,
  travelBufferMin: number,
): TimeSlot[] {
  const totalMin = durationMin + travelBufferMin;
  const slots: TimeSlot[] = [];
  let cursor = new Date(timeMin);
  const end = new Date(timeMax);

  while (cursor < end && slots.length < 6) {
    const hour = cursor.getHours();
    if (hour >= 8 && hour < 17) {
      const start = cursor.toISOString();
      slots.push({ start, end: addMinutes(start, totalMin) });
    }
    cursor = new Date(cursor.getTime() + 2 * 60 * 60_000);
  }

  return slots.slice(0, 3);
}

export async function getAvailableSlots(
  business: Business,
  options: {
    timeMin: string;
    timeMax: string;
    durationMin: number;
    travelBufferMin?: number;
  },
): Promise<TimeSlot[]> {
  const travelBufferMin = options.travelBufferMin ?? 30;
  const totalDurationMin = options.durationMin + travelBufferMin;

  if (env.MOCK_MODE) {
    return generateMockSlots(
      options.timeMin,
      options.timeMax,
      options.durationMin,
      travelBufferMin,
    );
  }

  const config = parseCalendarConfig(business);
  const businessHours = BusinessHoursSchema.parse(business.businessHours);
  const accessToken = await getAccessToken(config);

  const response = await withRetry(async () => {
    const res = await fetch(`${GOOGLE_CALENDAR_BASE}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        timeZone: business.timezone,
        items: [{ id: config.calendarId }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new GoogleCalendarError(
        `Google FreeBusy failed: ${res.status} ${text}`,
        res.status,
      );
    }

    return res;
  });

  const data = (await response.json()) as FreeBusyResponse;
  const busy = data.calendars[config.calendarId]?.busy ?? [];

  const slots: TimeSlot[] = [];
  let cursor = new Date(options.timeMin);
  const end = new Date(options.timeMax);

  while (cursor < end && slots.length < 6) {
    const slotStart = cursor.toISOString();
    const appointmentEnd = addMinutes(slotStart, options.durationMin);
    const blockedEnd = addMinutes(slotStart, totalDurationMin);
    const local = getLocalSchedulePosition(cursor, business.timezone);
    const hours = businessHours[local.day];

    if (!hours) {
      cursor = new Date(cursor.getTime() + 30 * 60_000);
      continue;
    }

    const opensAt = parseTimeToMinutes(hours[0]);
    const closesAt = parseTimeToMinutes(hours[1]);
    const fitsBusinessHours =
      local.minuteOfDay >= opensAt &&
      local.minuteOfDay + totalDurationMin <= closesAt;

    const overlaps = busy.some(
      (b) => new Date(b.start) < new Date(blockedEnd) && new Date(b.end) > cursor,
    );

    if (fitsBusinessHours && !overlaps) {
      slots.push({ start: slotStart, end: appointmentEnd });
    }

    cursor = new Date(cursor.getTime() + 30 * 60_000);
  }

  return slots.slice(0, 3);
}

export async function createCalendarEvent(
  business: Business,
  event: BookingEventInput,
): Promise<{ eventId: string; htmlLink?: string }> {
  if (env.MOCK_MODE) {
    return {
      eventId: `mock_event_${Date.now().toString(36)}`,
      htmlLink: "https://calendar.google.com/mock",
    };
  }

  const config = parseCalendarConfig(business);
  const accessToken = await getAccessToken(config);

  const response = await withRetry(async () => {
    const res = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(config.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start, timeZone: business.timezone },
          end: { dateTime: event.end, timeZone: business.timezone },
          attendees: event.attendeeEmail
            ? [{ email: event.attendeeEmail }]
            : undefined,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new GoogleCalendarError(
        `Google event insert failed: ${res.status} ${text}`,
        res.status,
      );
    }

    return res;
  });

  const data = (await response.json()) as EventInsertResponse;
  return { eventId: data.id, htmlLink: data.htmlLink };
}

export async function deleteCalendarEvent(
  business: Business,
  eventId: string,
): Promise<void> {
  if (env.MOCK_MODE) {
    return;
  }

  const config = parseCalendarConfig(business);
  const accessToken = await getAccessToken(config);

  await withRetry(async () => {
    const res = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new GoogleCalendarError(
        `Google event delete failed: ${res.status} ${text}`,
        res.status,
      );
    }

    return res;
  });
}

export function formatSlotForSms(slot: TimeSlot, timezone: string): string {
  const start = new Date(slot.start);
  return start.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function mapIntent(value: unknown): Intent | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if (
    ["EMERGENCY", "SERVICE_REQUEST", "QUOTE", "RESCHEDULE", "OTHER"].includes(
      upper,
    )
  ) {
    return upper as Intent;
  }
  return null;
}

export function mapOutcome(value: unknown): Outcome | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  if (
    ["BOOKED", "TRANSFERRED", "MESSAGE_TAKEN", "MISSED_INFO"].includes(upper)
  ) {
    return upper as Outcome;
  }
  return null;
}
