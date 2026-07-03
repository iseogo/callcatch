import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { env, requireLiveCredentials } from "@/env";
import { GoogleCalendarConfigSchema } from "@/lib/business-schemas";
import { GoogleCalendarError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar";
const STATE_MAX_AGE_MS = 10 * 60_000;

interface OAuthState {
  businessId: string;
  issuedAt: number;
  nonce: string;
}

interface GoogleAuthorizationTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

function stateSecret(): string {
  if (!env.PROVISIONING_SECRET) {
    throw new GoogleCalendarError(
      "PROVISIONING_SECRET is required for Google OAuth state signing",
      500,
    );
  }
  return env.PROVISIONING_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", stateSecret())
    .update(value)
    .digest("base64url");
}

export function createGoogleOAuthState(businessId: string): string {
  const payload: OAuthState = {
    businessId,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGoogleOAuthState(value: string): OAuthState {
  const [encoded, suppliedSignature] = value.split(".");
  if (!encoded || !suppliedSignature) {
    throw new GoogleCalendarError("Invalid Google OAuth state", 400);
  }

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new GoogleCalendarError("Invalid Google OAuth state signature", 400);
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as OAuthState;

  if (
    typeof payload.businessId !== "string" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.nonce !== "string" ||
    Date.now() - payload.issuedAt > STATE_MAX_AGE_MS ||
    payload.issuedAt > Date.now() + 60_000
  ) {
    throw new GoogleCalendarError("Expired Google OAuth state", 400);
  }

  return payload;
}

export function buildGoogleAuthorizationUrl(businessId: string): string {
  requireLiveCredentials("google");
  if (!env.GOOGLE_REDIRECT_URI) {
    throw new GoogleCalendarError("GOOGLE_REDIRECT_URI is not configured");
  }

  const query = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: createGoogleOAuthState(businessId),
  });

  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

export async function connectGoogleCalendar(
  businessId: string,
  code: string,
): Promise<void> {
  requireLiveCredentials("google");
  if (!env.GOOGLE_REDIRECT_URI) {
    throw new GoogleCalendarError("GOOGLE_REDIRECT_URI is not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: env.GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GoogleCalendarError(
      `Google authorization failed: ${response.status} ${body}`,
      response.status,
    );
  }

  const tokens = (await response.json()) as GoogleAuthorizationTokenResponse;
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });
  const existing = GoogleCalendarConfigSchema.safeParse(
    business.calendarConfig,
  );
  const refreshToken =
    tokens.refresh_token ??
    (existing.success && existing.data.refreshToken !== "mock_refresh"
      ? existing.data.refreshToken
      : null);

  if (!refreshToken) {
    throw new GoogleCalendarError(
      "Google did not return a refresh token. Revoke the existing app grant and reconnect.",
      400,
    );
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      calendarType: "GOOGLE",
      calendarConfig: {
        calendarId: existing.success ? existing.data.calendarId : "primary",
        refreshToken,
        accessToken: tokens.access_token,
        tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      } satisfies Prisma.InputJsonValue,
    },
  });
}
