import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { getErrorMessage } from "@/lib/errors";
import { activateBusinessLive } from "@/lib/provisioning";

const ActivateSchema = z.object({
  voiceId: z.string().min(1).default("11labs-Adrian"),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const authorization = request.headers.get("authorization");
  if (
    !env.PROVISIONING_SECRET ||
    authorization !== `Bearer ${env.PROVISIONING_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = ActivateSchema.parse(await request.json());
    const result = await activateBusinessLive(params.id, body.voiceId);
    return NextResponse.json({
      businessId: result.business.id,
      phoneNumber: result.business.phoneNumber,
      retellAgentId: result.retell.agentId,
      status: result.business.status,
    });
  } catch (error) {
    console.error("POST /api/businesses/:id/activate failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
