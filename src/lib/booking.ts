import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  formatSlotForSms,
  getAvailableSlots,
} from "@/lib/google-calendar";
import { ServicesSchema } from "@/lib/business-schemas";
import { sendThreadSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";

export const CalendarSlotsSchema = z.object({
  businessId: z.string().min(1),
  durationMin: z.number().int().positive(),
  timeMin: z.string().datetime(),
  timeMax: z.string().datetime(),
});

export const CalendarBookSchema = z.object({
  businessId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(10),
  address: z.string().min(1),
  issue: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  durationMin: z.number().int().positive().optional(),
  callId: z.string().optional(),
});

export async function getCalendarSlots(
  input: z.infer<typeof CalendarSlotsSchema>,
) {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: input.businessId },
  });

  const slots = await getAvailableSlots(business, {
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    durationMin: input.durationMin,
  });

  return {
    businessId: business.id,
    slots: slots.map((slot) => ({
      ...slot,
      label: formatSlotForSms(slot, business.timezone),
    })),
  };
}

export async function bookCalendarAppointment(
  input: z.infer<typeof CalendarBookSchema>,
) {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: input.businessId },
  });

  const services = ServicesSchema.parse(business.services);
  const durationMin =
    input.durationMin ?? services[0]?.durationMin ?? 60;

  const { eventId, htmlLink } = await createCalendarEvent(business, {
    summary: `${business.name}: ${input.issue}`,
    description: `Customer: ${input.customerName}\nPhone: ${input.customerPhone}\nIssue: ${input.issue}`,
    location: input.address,
    start: input.start,
    end: input.end,
  });

  const booking = await prisma.booking.create({
    data: {
      businessId: business.id,
      callId: input.callId,
      customerName: input.customerName,
      customerPhone: normalizePhone(input.customerPhone),
      address: input.address,
      issue: input.issue,
      scheduledAt: new Date(input.start),
      confirmed: true,
    },
  });

  if (business.phoneNumber) {
    const when = formatSlotForSms(
      { start: input.start, end: input.end },
      business.timezone,
    );

    await sendThreadSms({
      businessId: business.id,
      fromNumber: business.phoneNumber,
      toPhone: input.customerPhone,
      body: `Your appointment with ${business.name} is confirmed for ${when} at ${input.address}. Reply if you need to reschedule.`,
    });
  }

  return {
    bookingId: booking.id,
    calendarEventId: eventId,
    calendarLink: htmlLink,
    scheduledAt: booking.scheduledAt,
  };
}
