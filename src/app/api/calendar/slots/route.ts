import { NextResponse } from "next/server";
import {
  CalendarSlotsSchema,
  getCalendarSlots,
} from "@/lib/booking";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = CalendarSlotsSchema.parse(await request.json());
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
