import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import {
  processCallAnalyzed,
  upsertCallFromWebhook,
} from "@/lib/post-call";
import {
  verifyRetellWebhookSignature,
  type RetellWebhookPayload,
} from "@/lib/retell";
import { safeJsonParse } from "@/lib/safe-json-parse";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-retell-signature");

  if (!verifyRetellWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = safeJsonParse<RetellWebhookPayload>(rawBody);

    switch (payload.event) {
      case "call_started":
      case "call_ended": {
        const { call, business } = await upsertCallFromWebhook(payload);
        return NextResponse.json({
          ok: true,
          callId: call.id,
          businessId: business?.id,
        });
      }
      case "call_analyzed": {
        const call = await processCallAnalyzed(payload);
        return NextResponse.json({ ok: true, callId: call.id });
      }
      default:
        return NextResponse.json({ ok: true, ignored: payload.event });
    }
  } catch (error) {
    console.error("Retell webhook error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
