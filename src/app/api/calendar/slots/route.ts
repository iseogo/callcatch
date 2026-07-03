import { NextResponse } from "next/server";
import {
  CalendarSlotsSchema,
  getCalendarSlots,
} from "@/lib/booking";
import { getErrorMessage } from "@/lib/errors";
import { parseVerifiedRetellBody } from "@/lib/request-auth";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const input = parseVerifiedRetellBody<unknown>(
      rawBody,
      request.headers.get("x-retell-signature"),
    );
    const body = CalendarSlotsSchema.parse(input);
    const result = await getCalendarSlots(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/calendar/slots failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
