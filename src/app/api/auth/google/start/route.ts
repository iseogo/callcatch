import { NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl } from "@/lib/google-oauth";
import { getErrorMessage } from "@/lib/errors";
import { isDashboardAuthorized } from "@/lib/request-auth";

export async function GET(request: Request) {
  if (!isDashboardAuthorized(request)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="CallCatch owner dashboard"',
      },
    });
  }

  try {
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 },
      );
    }
    return NextResponse.redirect(buildGoogleAuthorizationUrl(businessId));
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
