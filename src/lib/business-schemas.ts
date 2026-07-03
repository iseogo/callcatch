import { z } from "zod";

export const BusinessHoursSchema = z.record(
  z.string(),
  z.tuple([z.string(), z.string()]).nullable(),
);

export const ServiceAreaSchema = z.union([
  z.object({
    type: z.literal("zip_codes"),
    zipCodes: z.array(z.string().min(3)),
  }),
  z.object({
    type: z.literal("radius"),
    centerZip: z.string().min(3),
    radiusMiles: z.number().positive(),
  }),
]);

export const ServiceSchema = z.object({
  name: z.string().min(1),
  durationMin: z.number().int().positive(),
  priceRangeMin: z.number().optional(),
  priceRangeMax: z.number().optional(),
});

export const ServicesSchema = z.array(ServiceSchema).min(1);

export const GoogleCalendarConfigSchema = z.object({
  calendarId: z.string().min(1),
  refreshToken: z.string().min(1),
  accessToken: z.string().optional(),
  tokenExpiresAt: z.number().optional(),
});

export const CalendarConfigSchema = z.union([
  GoogleCalendarConfigSchema,
  z.record(z.unknown()),
]);

export type BusinessHours = z.infer<typeof BusinessHoursSchema>;
export type ServiceArea = z.infer<typeof ServiceAreaSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type GoogleCalendarConfig = z.infer<typeof GoogleCalendarConfigSchema>;

export const CreateBusinessSchema = z.object({
  name: z.string().min(1),
  ownerPhone: z.string().min(10),
  onCallPhone: z.string().min(10).optional(),
  trade: z.enum(["PLUMBING", "HVAC", "ELECTRICAL", "OTHER"]),
  timezone: z.string().min(1),
  businessHours: BusinessHoursSchema,
  serviceArea: ServiceAreaSchema,
  services: ServicesSchema,
  calendarType: z.enum(["GOOGLE", "JOBBER", "HOUSECALL_PRO"]).default("GOOGLE"),
  calendarConfig: CalendarConfigSchema,
  /** E.164 number to purchase on SignalWire. Required in live mode. */
  desiredPhoneNumber: z.string().optional(),
  voiceId: z.string().default("11labs-Adrian"),
});

export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
