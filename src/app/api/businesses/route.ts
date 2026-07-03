import { NextResponse } from "next/server";
import { env } from "@/env";
import { CreateBusinessSchema } from "@/lib/business-schemas";
import { getErrorMessage } from "@/lib/errors";
import { provisionBusiness } from "@/lib/provisioning";

function authorizeProvisioning(request: Request): boolean {
  if (!env.PROVISIONING_SECRET) {
    return env.MOCK_MODE;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.PROVISIONING_SECRET}`;
}

export async function POST(request: Request) {
  try {
    if (!authorizeProvisioning(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = CreateBusinessSchema.parse(await request.json());
    const result = await provisionBusiness(body);

    return NextResponse.json(
      {
        businessId: result.business.id,
        name: result.business.name,
        phoneNumber: result.business.phoneNumber,
        retellAgentId: result.business.retellAgentId,
        status: result.business.status,
        retell: result.retell,
        signalwire: result.signalwire,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/businesses failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
