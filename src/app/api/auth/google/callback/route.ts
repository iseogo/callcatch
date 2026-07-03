import { NextResponse } from "next/server";
import {
  connectGoogleCalendar,
  verifyGoogleOAuthState,
} from "@/lib/google-oauth";
import { getErrorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.json(
      { error: `Google authorization was declined: ${oauthError}` },
      { status: 400 },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing Google authorization code or state" },
      { status: 400 },
    );
  }

  try {
    const payload = verifyGoogleOAuthState(state);
    await connectGoogleCalendar(payload.businessId, code);
    return NextResponse.redirect(
      new URL("/dashboard/settings?google=connected", request.url),
    );
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
