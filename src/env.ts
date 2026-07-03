import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MOCK_MODE: booleanFromString,

    // Retell AI — https://docs.retellai.com/
    RETELL_API_KEY: z.string().min(1).optional(),

    // SignalWire — https://signalwire.com/docs
    SIGNALWIRE_PROJECT_ID: z.string().min(1).optional(),
    SIGNALWIRE_API_TOKEN: z.string().min(1).optional(),
    SIGNALWIRE_SPACE_URL: z.string().url().optional(),

    // SignalWire SIP trunk for Retell import-phone-number
    SIGNALWIRE_SIP_TERMINATION_URI: z.string().min(1).optional(),
    SIGNALWIRE_SIP_USERNAME: z.string().min(1).optional(),
    SIGNALWIRE_SIP_PASSWORD: z.string().min(1).optional(),

    // Google Calendar OAuth (platform-level; per-business tokens in calendarConfig)
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),

    // Protect provisioning + dev simulation endpoints
    PROVISIONING_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    MOCK_MODE: process.env.MOCK_MODE,
    RETELL_API_KEY: process.env.RETELL_API_KEY,
    SIGNALWIRE_PROJECT_ID: process.env.SIGNALWIRE_PROJECT_ID,
    SIGNALWIRE_API_TOKEN: process.env.SIGNALWIRE_API_TOKEN,
    SIGNALWIRE_SPACE_URL: process.env.SIGNALWIRE_SPACE_URL,
    SIGNALWIRE_SIP_TERMINATION_URI: process.env.SIGNALWIRE_SIP_TERMINATION_URI,
    SIGNALWIRE_SIP_USERNAME: process.env.SIGNALWIRE_SIP_USERNAME,
    SIGNALWIRE_SIP_PASSWORD: process.env.SIGNALWIRE_SIP_PASSWORD,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    PROVISIONING_SECRET: process.env.PROVISIONING_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});

export function requireLiveCredentials(
  service: "retell" | "signalwire" | "google",
): void {
  if (env.MOCK_MODE) {
    return;
  }

  const missing: string[] = [];

  if (service === "retell" && !env.RETELL_API_KEY) {
    missing.push("RETELL_API_KEY");
  }

  if (service === "signalwire") {
    if (!env.SIGNALWIRE_PROJECT_ID) missing.push("SIGNALWIRE_PROJECT_ID");
    if (!env.SIGNALWIRE_API_TOKEN) missing.push("SIGNALWIRE_API_TOKEN");
    if (!env.SIGNALWIRE_SPACE_URL) missing.push("SIGNALWIRE_SPACE_URL");
  }

  if (service === "google") {
    if (!env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required env for ${service} (set MOCK_MODE=true to skip): ${missing.join(", ")}`,
    );
  }
}
