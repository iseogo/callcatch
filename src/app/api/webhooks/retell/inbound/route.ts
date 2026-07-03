import { NextResponse } from "next/server";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { getErrorMessage } from "@/lib/errors";
import {
  renderTradesAgentBeginMessage,
  renderTradesAgentPrompt,
} from "@/packs/trades-agent";
import type { BusinessHours, Service, ServiceArea } from "@/lib/business-schemas";

interface InboundWebhookPayload {
  event?: string;
  from_number?: string;
  to_number?: string;
  agent_id?: string;
}

function formatBusinessHours(hours: BusinessHours): string {
  return Object.entries(hours)
    .map(([day, range]) =>
      range ? `${day}: ${range[0]}–${range[1]}` : `${day}: closed`,
    )
    .join("; ");
}

function formatServiceArea(area: ServiceArea): string {
  if (area.type === "zip_codes") {
    return `ZIP codes: ${area.zipCodes.join(", ")}`;
  }
  return `${area.radiusMiles} mile radius from ${area.centerZip}`;
}

function formatServices(services: Service[]): string {
  return services
    .map((s) => `${s.name} (${s.durationMin} min)`)
    .join("; ");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as InboundWebhookPayload;
    const toNumber = payload.to_number
      ? normalizePhone(payload.to_number)
      : null;

    if (!toNumber) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 },
      );
    }

    const business = await prisma.business.findFirst({
      where: { phoneNumber: toNumber },
    });

    if (!business || !business.retellAgentId) {
      return NextResponse.json(
        { error: "Business not found for number" },
        { status: 404 },
      );
    }

    const hours = business.businessHours as BusinessHours;
    const serviceArea = business.serviceArea as ServiceArea;
    const services = business.services as Service[];

    return NextResponse.json({
      call_inbound: {
        override_agent_id: business.retellAgentId,
        dynamic_variables: {
          businessId: business.id,
          businessName: business.name,
        },
        metadata: {
          businessId: business.id,
        },
        agent_override: {
          agent: {
            begin_message: renderTradesAgentBeginMessage(business.name),
          },
          retell_llm: {
            general_prompt: renderTradesAgentPrompt({
              businessName: business.name,
              trade: business.trade,
              timezone: business.timezone,
              businessHours: formatBusinessHours(hours),
              serviceArea: formatServiceArea(serviceArea),
              services: formatServices(services),
              ownerPhone: business.ownerPhone,
              onCallPhone: business.onCallPhone ?? business.ownerPhone,
              appUrl: env.NEXT_PUBLIC_APP_URL,
            }),
          },
        },
      },
    });
  } catch (error) {
    console.error("Retell inbound webhook error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
