import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  if (process.env.MOCK_MODE === "true" && !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ") && password) {
    try {
      const credentials = atob(authorization.slice("Basic ".length));
      const separator = credentials.indexOf(":");
      const username = credentials.slice(0, separator);
      const suppliedPassword = credentials.slice(separator + 1);

      if (username === "owner" && suppliedPassword === password) {
        return NextResponse.next();
      }
    } catch {
      // Fall through to the authentication challenge.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CallCatch owner dashboard"',
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
