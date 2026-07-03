import { env } from "@/env";
import { safeJsonParse } from "@/lib/safe-json-parse";
import { verifyRetellWebhookSignature } from "@/lib/retell";

interface RetellToolEnvelope {
  args?: unknown;
}

export function isDashboardAuthorized(request: Request): boolean {
  if (env.MOCK_MODE && !env.DASHBOARD_PASSWORD) {
    return true;
  }

  if (!env.DASHBOARD_PASSWORD) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const credentials = Buffer.from(
      authorization.slice("Basic ".length),
      "base64",
    ).toString("utf8");
    const separator = credentials.indexOf(":");
    const username = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);
    return username === "owner" && password === env.DASHBOARD_PASSWORD;
  } catch {
    return false;
  }
}

export function parseVerifiedRetellBody<T>(
  rawBody: string,
  signature: string | null,
): T {
  if (!verifyRetellWebhookSignature(rawBody, signature)) {
    throw new Error("Invalid Retell signature");
  }

  const parsed = safeJsonParse<T | RetellToolEnvelope>(rawBody);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "args" in parsed &&
    parsed.args !== undefined
  ) {
    return parsed.args as T;
  }

  return parsed as T;
}
