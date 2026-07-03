import type { Prisma } from "@prisma/client";
import { env } from "@/env";
import type { CreateBusinessInput } from "@/lib/business-schemas";
import {
  createRetellAgent,
  createRetellLlm,
  importRetellPhoneNumber,
} from "@/lib/retell";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  renderTradesAgentBeginMessage,
  renderTradesAgentPrompt,
  TRADES_AGENT_POST_CALL_ANALYSIS,
} from "@/packs/trades-agent";
import { purchasePhoneNumber, updatePhoneNumber } from "@/lib/signalwire";

function formatBusinessHours(
  hours: CreateBusinessInput["businessHours"],
): string {
  return Object.entries(hours)
    .map(([day, range]) =>
      range ? `${day}: ${range[0]}–${range[1]}` : `${day}: closed`,
    )
    .join("; ");
}

function formatServiceArea(area: CreateBusinessInput["serviceArea"]): string {
  if (area.type === "zip_codes") {
    return `ZIP codes: ${area.zipCodes.join(", ")}`;
  }
  return `${area.radiusMiles} mile radius from ${area.centerZip}`;
}

function formatServices(services: CreateBusinessInput["services"]): string {
  return services
    .map((s) => {
      const price =
        s.priceRangeMin && s.priceRangeMax
          ? ` ($${s.priceRangeMin}–$${s.priceRangeMax})`
          : "";
      return `${s.name} (${s.durationMin} min)${price}`;
    })
    .join("; ");
}

function buildRetellTools(appUrl: string): Array<Record<string, unknown>> {
  return [
    {
      type: "end_call",
      name: "end_call",
      description: "End the call when the conversation is complete.",
    },
    {
      type: "transfer_call",
      name: "transfer_call",
      description:
        "Transfer the call to the on-call technician for after-hours emergencies.",
    },
    {
      type: "custom",
      name: "check_availability",
      description: "Check available appointment slots for a service.",
      speak_during_execution: true,
      speak_after_execution: true,
      url: `${appUrl}/api/calendar/slots`,
      method: "POST",
      parameters: {
        type: "object",
        properties: {
          businessId: { type: "string" },
          durationMin: { type: "number" },
          timeMin: { type: "string" },
          timeMax: { type: "string" },
        },
        required: ["businessId", "durationMin", "timeMin", "timeMax"],
      },
    },
    {
      type: "custom",
      name: "book_appointment",
      description: "Book an appointment on the calendar.",
      speak_during_execution: true,
      speak_after_execution: true,
      url: `${appUrl}/api/calendar/book`,
      method: "POST",
      parameters: {
        type: "object",
        properties: {
          businessId: { type: "string" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          address: { type: "string" },
          issue: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          durationMin: { type: "number" },
        },
        required: [
          "businessId",
          "customerName",
          "customerPhone",
          "address",
          "issue",
          "start",
          "end",
        ],
      },
    },
  ];
}

export async function provisionBusiness(input: CreateBusinessInput) {
  const phoneNumber =
    input.desiredPhoneNumber ??
    (env.MOCK_MODE ? "+14025550100" : undefined);

  if (!phoneNumber) {
    throw new Error(
      "desiredPhoneNumber is required when MOCK_MODE is false",
    );
  }

  const normalizedPhone = normalizePhone(phoneNumber);
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  const business = await prisma.business.create({
    data: {
      name: input.name,
      ownerPhone: normalizePhone(input.ownerPhone),
      onCallPhone: input.onCallPhone
        ? normalizePhone(input.onCallPhone)
        : null,
      trade: input.trade,
      timezone: input.timezone,
      businessHours: input.businessHours,
      serviceArea: input.serviceArea,
      services: input.services,
      calendarType: input.calendarType,
      calendarConfig: input.calendarConfig as Prisma.InputJsonValue,
      status: "TRIAL",
    },
  });

  const prompt = renderTradesAgentPrompt({
    businessName: business.name,
    trade: business.trade,
    timezone: business.timezone,
    businessHours: formatBusinessHours(input.businessHours),
    serviceArea: formatServiceArea(input.serviceArea),
    services: formatServices(input.services),
    ownerPhone: business.ownerPhone,
    onCallPhone: business.onCallPhone ?? business.ownerPhone,
    appUrl,
  });

  const llm = await createRetellLlm({
    general_prompt: prompt,
    begin_message: renderTradesAgentBeginMessage(business.name),
    general_tools: buildRetellTools(appUrl),
    post_call_analysis_data: TRADES_AGENT_POST_CALL_ANALYSIS.map((field) => ({
      name: field.name,
      type: field.type,
      description: field.description,
      ...("choices" in field && field.choices
        ? { choices: [...field.choices] }
        : {}),
    })),
  });

  const agent = await createRetellAgent({
    llm_id: llm.llm_id,
    agent_name: `${business.name} Receptionist`,
    voice_id: input.voiceId,
    webhook_url: `${appUrl}/api/webhooks/retell`,
    webhook_events: ["call_started", "call_ended", "call_analyzed"],
  });

  const purchased = await purchasePhoneNumber({
    number: normalizedPhone,
    name: business.name,
  });

  await updatePhoneNumber(purchased.id, {
    message_handler: "laml_webhooks",
    message_request_url: `${appUrl}/api/webhooks/signalwire/sms`,
    message_request_method: "POST",
  });

  await importRetellPhoneNumber({
    phone_number: normalizedPhone,
    termination_uri: env.SIGNALWIRE_SIP_TERMINATION_URI ?? "mock.pstn.signalwire.com",
    sip_trunk_auth_username: env.SIGNALWIRE_SIP_USERNAME,
    sip_trunk_auth_password: env.SIGNALWIRE_SIP_PASSWORD,
    inbound_agents: [{ agent_id: agent.agent_id, weight: 1 }],
    inbound_webhook_url: `${appUrl}/api/webhooks/retell/inbound`,
  });

  const updated = await prisma.business.update({
    where: { id: business.id },
    data: {
      phoneNumber: normalizedPhone,
      retellAgentId: agent.agent_id,
    },
  });

  return {
    business: updated,
    retell: { llmId: llm.llm_id, agentId: agent.agent_id },
    signalwire: { phoneNumberId: purchased.id, phoneNumber: normalizedPhone },
  };
}
