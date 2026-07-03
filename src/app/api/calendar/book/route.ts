import { NextResponse } from "next/server";
import {
  bookCalendarAppointment,
  CalendarBookSchema,
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
    const body = CalendarBookSchema.parse(input);
    const result = await bookCalendarAppointment(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/calendar/book failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
