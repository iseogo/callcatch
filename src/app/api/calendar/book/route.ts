import { NextResponse } from "next/server";
import {
  bookCalendarAppointment,
  CalendarBookSchema,
} from "@/lib/booking";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = CalendarBookSchema.parse(await request.json());
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
