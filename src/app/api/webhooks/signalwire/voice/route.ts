import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildRetellInboundLaml,
  verifySignalWireWebhook,
} from "@/lib/signalwire";

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
    select: { phoneNumber: true, status: true },
  });

  if (!business || business.status !== "ACTIVE") {
    return NextResponse.json({ error: "Number is not active" }, { status: 404 });
  }

  return new NextResponse(
    buildRetellInboundLaml(business.phoneNumber ?? calledNumber),
    {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    },
  );
}
