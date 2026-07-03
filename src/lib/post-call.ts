import type { Business, Call, Intent, Outcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  mapIntent,
  mapOutcome,
} from "@/lib/google-calendar";
import { normalizePhone } from "@/lib/phone";
import type { RetellCall, RetellWebhookPayload } from "@/lib/retell";
import { sendThreadSms } from "@/lib/sms";

function getMetadataBusinessId(call: RetellCall): string | null {
  const id = call.metadata?.businessId;
  return typeof id === "string" ? id : null;
}

async function findBusinessForCall(call: RetellCall): Promise<Business | null> {
  const businessId = getMetadataBusinessId(call);
  if (businessId) {
    return prisma.business.findUnique({ where: { id: businessId } });
  }

  if (call.agent_id) {
    return prisma.business.findFirst({
      where: { retellAgentId: call.agent_id },
    });
  }

  if (call.to_number) {
    return prisma.business.findFirst({
      where: { phoneNumber: normalizePhone(call.to_number) },
    });
  }

  return null;
}

function durationSec(call: RetellCall): number | null {
  if (call.start_timestamp && call.end_timestamp) {
    return Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  }
  if (call.duration_ms) {
    return Math.round(call.duration_ms / 1000);
  }
  return null;
}

export async function upsertCallFromWebhook(
  payload: RetellWebhookPayload,
): Promise<{ call: Call; business: Business | null }> {
  const business = await findBusinessForCall(payload.call);

  if (!business) {
    throw new Error(
      `No business found for Retell call ${payload.call.call_id}`,
    );
  }

  const callerPhone = payload.call.from_number
    ? normalizePhone(payload.call.from_number)
    : "unknown";

  const existing = await prisma.call.findUnique({
    where: { retellCallId: payload.call.call_id },
  });

  const baseData = {
    businessId: business.id,
    callerPhone,
    startedAt: payload.call.start_timestamp
      ? new Date(payload.call.start_timestamp)
      : new Date(),
    durationSec: durationSec(payload.call),
    transcript: payload.call.transcript ?? existing?.transcript,
  };

  const call = existing
    ? await prisma.call.update({
        where: { id: existing.id },
        data: baseData,
      })
    : await prisma.call.create({
        data: {
          ...baseData,
          retellCallId: payload.call.call_id,
        },
      });

  return { call, business };
}

export async function processCallAnalyzed(
  payload: RetellWebhookPayload,
): Promise<Call> {
  const { call, business } = await upsertCallFromWebhook(payload);
  if (!business) {
    throw new Error(`Business missing for call ${payload.call.call_id}`);
  }
  const analysis = payload.call.call_analysis;
  const custom = analysis?.custom_analysis_data ?? {};

  const intent = mapIntent(custom.intent) ?? mapIntent(custom["intent"]);
  const outcome = mapOutcome(custom.outcome) ?? mapOutcome(custom["outcome"]);
  const jobValueRaw = custom.job_value_estimate;
  const jobValueEstimate =
    typeof jobValueRaw === "number"
      ? jobValueRaw
      : typeof jobValueRaw === "string"
        ? Number.parseFloat(jobValueRaw)
        : null;

  const updatedCall = await prisma.call.update({
    where: { id: call.id },
    data: {
      intent,
      outcome,
      summary: analysis?.call_summary ?? call.summary,
      jobValueEstimate: Number.isFinite(jobValueEstimate ?? NaN)
        ? jobValueEstimate
        : null,
      durationSec: durationSec(payload.call) ?? call.durationSec,
      transcript: payload.call.transcript ?? call.transcript,
    },
  });

  if (business.phoneNumber) {
    await notifyOwnerPostCall(business, updatedCall, custom, intent, outcome);
  }

  if (
    outcome === "BOOKED" &&
    typeof custom.customer_name === "string" &&
    typeof custom.service_address === "string" &&
    typeof custom.scheduled_at === "string"
  ) {
    const bookingData = {
      customerName: custom.customer_name,
      customerPhone:
        typeof custom.customer_phone === "string"
          ? normalizePhone(custom.customer_phone)
          : call.callerPhone,
      address: custom.service_address,
      issue:
        typeof custom.issue_description === "string"
          ? custom.issue_description
          : "Service request",
      scheduledAt: new Date(custom.scheduled_at),
      confirmed: true,
    };

    const existingBooking = await prisma.booking.findFirst({
      where: { callId: call.id },
    });

    if (existingBooking) {
      await prisma.booking.update({
        where: { id: existingBooking.id },
        data: bookingData,
      });
    } else {
      await prisma.booking.create({
        data: {
          businessId: business.id,
          callId: call.id,
          ...bookingData,
        },
      });
    }
  }

  return updatedCall;
}

async function notifyOwnerPostCall(
  business: Business,
  call: Call,
  custom: Record<string, unknown>,
  intent: Intent | null,
  outcome: Outcome | null,
): Promise<void> {
  if (!business.phoneNumber) {
    return;
  }

  const isEmergency = custom.is_emergency === true || intent === "EMERGENCY";
  const prefix = isEmergency ? "🚨" : outcome === "BOOKED" ? "✅" : "📞";

  const issue =
    typeof custom.issue_description === "string"
      ? custom.issue_description
      : "service call";

  const address =
    typeof custom.service_address === "string"
      ? custom.service_address
      : "address TBD";

  const scheduled =
    typeof custom.scheduled_at === "string"
      ? new Date(custom.scheduled_at).toLocaleString("en-US", {
          timeZone: business.timezone,
        })
      : null;

  const value =
    call.jobValueEstimate && call.jobValueEstimate > 0
      ? ` — ~$${Math.round(call.jobValueEstimate)}`
      : "";

  let body: string;

  if (outcome === "BOOKED" && scheduled) {
    body = `${prefix} Job booked: ${issue}, ${address}, ${scheduled}${value}`;
  } else if (outcome === "TRANSFERRED") {
    body = `${prefix} Emergency call transferred from ${call.callerPhone}. ${issue} at ${address}`;
  } else if (outcome === "MESSAGE_TAKEN") {
    body = `${prefix} Message from ${call.callerPhone}: ${issue}`;
  } else {
    body = `${prefix} Call from ${call.callerPhone}: ${call.summary ?? issue}${value}`;
  }

  await sendThreadSms({
    businessId: business.id,
    fromNumber: business.phoneNumber,
    toPhone: business.ownerPhone,
    body,
  });
}
