import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { getErrorMessage } from "@/lib/errors";
import { recordInboundSms } from "@/lib/sms";
import {
  buildSmsReplyLaml,
  verifySignalWireWebhook,
} from "@/lib/signalwire";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const params = Object.fromEntries(
      Array.from(formData.entries(), ([key, value]) => [
        key,
        value.toString(),
      ]),
    );

    if (
      !verifySignalWireWebhook(
        request.url,
        request.headers.get("x-signalwire-signature"),
        params,
      )
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const from = formData.get("From")?.toString();
    const to = formData.get("To")?.toString();
    const body = formData.get("Body")?.toString() ?? "";

    if (!from || !to) {
      return NextResponse.json(
        { error: "From and To are required" },
        { status: 400 },
      );
    }

    const business = await prisma.business.findFirst({
      where: { phoneNumber: normalizePhone(to) },
    });

    if (!business) {
      return new NextResponse(buildSmsReplyLaml("Thanks for your message."), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    await recordInboundSms(business.id, from, body);

    return new NextResponse(
      buildSmsReplyLaml(
        `Thanks! ${business.name} received your message and will follow up shortly.`,
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (error) {
    console.error("SignalWire SMS webhook error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
