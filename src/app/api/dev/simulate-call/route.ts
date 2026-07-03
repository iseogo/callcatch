import { NextResponse } from "next/server";
import { env } from "@/env";
import { getErrorMessage } from "@/lib/errors";
import { processCallAnalyzed } from "@/lib/post-call";
import type { RetellWebhookPayload } from "@/lib/retell";
import { prisma } from "@/lib/prisma";

/**
 * Dev-only endpoint to simulate a full post-call flow in MOCK_MODE.
 * POST /api/dev/simulate-call { businessId, callerPhone?, issue?, address? }
 */
export async function POST(request: Request) {
  if (!env.MOCK_MODE) {
    return NextResponse.json(
      { error: "Only available when MOCK_MODE=true" },
      { status: 403 },
    );
  }

  try {
    const body = (await request.json()) as {
      businessId: string;
      callerPhone?: string;
      issue?: string;
      address?: string;
      customerName?: string;
      scheduledAt?: string;
    };

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: body.businessId },
    });

    const callId = `mock_call_${Date.now().toString(36)}`;
    const scheduledAt =
      body.scheduledAt ??
      new Date(Date.now() + 24 * 60 * 60_000).toISOString();

    const payload: RetellWebhookPayload = {
      event: "call_analyzed",
      call: {
        call_id: callId,
        agent_id: business.retellAgentId ?? undefined,
        from_number: body.callerPhone ?? "+14025551234",
        to_number: business.phoneNumber ?? "+14025550100",
        direction: "inbound",
        start_timestamp: Date.now() - 180_000,
        end_timestamp: Date.now(),
        transcript: "Mock transcript for local testing.",
        metadata: { businessId: business.id },
        call_analysis: {
          call_summary: `Caller requested ${body.issue ?? "water heater repair"}.`,
          call_successful: true,
          custom_analysis_data: {
            intent: "SERVICE_REQUEST",
            outcome: "BOOKED",
            job_value_estimate: 450,
            customer_name: body.customerName ?? "Jane Doe",
            customer_phone: body.callerPhone ?? "+14025551234",
            service_address: body.address ?? "123 Main St, Omaha NE",
            issue_description: body.issue ?? "water heater repair",
            scheduled_at: scheduledAt,
            in_service_area: true,
            is_emergency: false,
          },
        },
      },
    };

    const call = await processCallAnalyzed(payload);

    return NextResponse.json({
      ok: true,
      simulatedRetellCallId: callId,
      callId: call.id,
      message:
        "Simulated call_analyzed webhook. Check console for mock SMS output.",
    });
  } catch (error) {
    console.error("simulate-call failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
