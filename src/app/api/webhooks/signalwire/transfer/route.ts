import { NextResponse } from "next/server";
import { buildTransferLaml } from "@/lib/signalwire";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to");

  if (!to) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Transfer unavailable.</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }

  return new NextResponse(buildTransferLaml(to), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
