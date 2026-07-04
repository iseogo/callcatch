import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildRetellInboundLaml,
  verifySignalWireWebhook,
} from "@/lib/signalwire";
import { registerRetellPhoneCall } from "@/lib/retell";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  if (
    !verifySignalWireWebhook(
      request.url,
      request.headers.get("x-signalwire-signature"),
      params,
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const calledNumber = params.To ?? "";
  if (!calledNumber) {
    return NextResponse.json({ error: "Missing called number" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { phoneNumber: calledNumber },
    select: { id: true, phoneNumber: true, retellAgentId: true, status: true },
  });

  if (!business || business.status !== "ACTIVE") {
    return NextResponse.json({ error: "Number is not active" }, { status: 404 });
  }

  if (!business.retellAgentId) {
    return NextResponse.json(
      { error: "Number has no Retell agent" },
      { status: 503 },
    );
  }

  const registeredCall = await registerRetellPhoneCall({
    agent_id: business.retellAgentId,
    from_number: params.From ?? "unknown",
    to_number: business.phoneNumber ?? calledNumber,
    direction: "inbound",
    metadata: {
      businessId: business.id,
      signalwireCallSid: params.CallSid ?? "",
    },
  });

  return new NextResponse(
    buildRetellInboundLaml(registeredCall.call_id),
    {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    },
  );
}
