import { createHmac, timingSafeEqual } from "crypto";
import { env, requireLiveCredentials } from "@/env";
import { SignalWireApiError } from "@/lib/errors";
import { withRetry } from "@/lib/retry";

export interface SignalWirePhoneNumber {
  id: string;
  number: string;
  name?: string;
}

export interface PurchasePhoneNumberInput {
  number: string;
  name?: string;
}

export interface UpdatePhoneNumberInput {
  name: string;
  call_handler?: "laml_webhooks" | "relay_context";
  call_request_url?: string;
  call_request_method?: "GET" | "POST";
  message_handler?: "laml_webhooks";
  message_request_url?: string;
  message_request_method?: "GET" | "POST";
}

export interface SendSmsInput {
  from: string;
  to: string;
  body: string;
}

export interface SendSmsResult {
  sid: string;
  status: string;
}

export interface InitiateTransferInput {
  from: string;
  to: string;
  transferTo: string;
  webhookUrl?: string;
}

export interface InitiateTransferResult {
  callSid: string;
  status: string;
}

export function verifySignalWireWebhook(
  requestUrl: string,
  signature: string | null,
  params: Record<string, string>,
): boolean {
  if (env.MOCK_MODE) {
    return true;
  }

  if (!env.SIGNALWIRE_SIGNING_KEY || !signature) {
    return false;
  }
  const signingKey = env.SIGNALWIRE_SIGNING_KEY;

  const urls = [requestUrl];
  const parsed = new URL(requestUrl);
  if (!parsed.port) {
    const credentials =
      parsed.username || parsed.password
        ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
        : "";
    const standardPort = parsed.protocol === "https:" ? "443" : "80";
    urls.push(
      `${parsed.protocol}//${credentials}${parsed.hostname}:${standardPort}${parsed.pathname}${parsed.search}${parsed.hash}`,
    );
  }

  return urls.some((url) => {
    const payload = Object.keys(params)
      .sort()
      .reduce((value, key) => value + key + (params[key] ?? ""), url);
    const expected = Buffer.from(
      createHmac("sha1", signingKey)
        .update(payload, "utf8")
        .digest("base64"),
    );
    const supplied = Buffer.from(signature);
    return (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    );
  });
}

function createTransferToken(transferTo: string): string {
  if (!env.PROVISIONING_SECRET) {
    throw new SignalWireApiError(
      "PROVISIONING_SECRET is required for transfer webhooks",
    );
  }
  return createHmac("sha256", env.PROVISIONING_SECRET)
    .update(transferTo)
    .digest("base64url");
}

export function verifyTransferToken(
  transferTo: string,
  token: string | null,
): boolean {
  if (!env.PROVISIONING_SECRET || !token) {
    return false;
  }

  const expected = Buffer.from(createTransferToken(transferTo));
  const supplied = Buffer.from(token);
  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

function getSignalWireBaseUrl(): string {
  if (!env.SIGNALWIRE_SPACE_URL) {
    throw new SignalWireApiError("SIGNALWIRE_SPACE_URL is not configured");
  }
  return env.SIGNALWIRE_SPACE_URL.replace(/\/$/, "");
}

function getAuthHeader(): string {
  if (!env.SIGNALWIRE_PROJECT_ID || !env.SIGNALWIRE_API_TOKEN) {
    throw new SignalWireApiError("SignalWire credentials are not configured");
  }
  const token = Buffer.from(
    `${env.SIGNALWIRE_PROJECT_ID}:${env.SIGNALWIRE_API_TOKEN}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function signalWireRelayFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  requireLiveCredentials("signalwire");

  const response = await withRetry(async () => {
    const res = await fetch(`${getSignalWireBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new SignalWireApiError(
        `SignalWire Relay API ${path} failed: ${res.status} ${body}`,
        res.status,
      );
    }

    return res;
  });

  return (await response.json()) as T;
}

async function signalWireLamlFetch<T>(
  path: string,
  body: URLSearchParams,
): Promise<T> {
  requireLiveCredentials("signalwire");

  const response = await withRetry(async () => {
    const res = await fetch(`${getSignalWireBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new SignalWireApiError(
        `SignalWire LaML API ${path} failed: ${res.status} ${text}`,
        res.status,
      );
    }

    return res;
  });

  return (await response.json()) as T;
}

function mockSid(prefix: string): string {
  return `${prefix}_mock_${Date.now().toString(36)}`;
}

export async function purchasePhoneNumber(
  input: PurchasePhoneNumberInput,
): Promise<SignalWirePhoneNumber> {
  if (env.MOCK_MODE) {
    return {
      id: mockSid("pn"),
      number: input.number,
      name: input.name,
    };
  }

  const data = await signalWireRelayFetch<{
    id: string;
    number: string;
    name?: string;
  }>("/api/relay/rest/phone_numbers", {
    method: "POST",
    body: JSON.stringify({ number: input.number, name: input.name }),
  });

  return {
    id: data.id,
    number: data.number,
    name: data.name,
  };
}

export async function updatePhoneNumber(
  phoneNumberId: string,
  input: UpdatePhoneNumberInput,
): Promise<SignalWirePhoneNumber> {
  if (env.MOCK_MODE) {
    return {
      id: phoneNumberId,
      number: "+14025550100",
    };
  }

  const data = await signalWireRelayFetch<{
    id: string;
    number: string;
    name?: string;
  }>(`/api/relay/rest/phone_numbers/${phoneNumberId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return {
    id: data.id,
    number: data.number,
    name: data.name,
  };
}

/** Send outbound SMS via SignalWire Compatibility (LaML) API. */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (env.MOCK_MODE) {
    console.info("[MOCK SMS]", { from: input.from, to: input.to, body: input.body });
    return { sid: mockSid("SM"), status: "queued" };
  }

  const params = new URLSearchParams({
    From: input.from,
    To: input.to,
    Body: input.body,
  });

  const data = await signalWireLamlFetch<{
    sid: string;
    status: string;
  }>(
    `/api/laml/2010-04-01/Accounts/${env.SIGNALWIRE_PROJECT_ID}/Messages.json`,
    params,
  );

  return { sid: data.sid, status: data.status };
}

/**
 * Initiate a live transfer by placing an outbound call that bridges caller to on-call phone.
 * Returns LaML call SID.
 */
export async function initiateLiveTransfer(
  input: InitiateTransferInput,
): Promise<InitiateTransferResult> {
  if (env.MOCK_MODE) {
    console.info("[MOCK TRANSFER]", input);
    return { callSid: mockSid("CA"), status: "queued" };
  }

  const twimlUrl = input.webhookUrl
    ? input.webhookUrl
    : `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire/transfer?to=${encodeURIComponent(input.transferTo)}&token=${encodeURIComponent(createTransferToken(input.transferTo))}`;

  const params = new URLSearchParams({
    From: input.from,
    To: input.to,
    Url: twimlUrl,
  });

  const data = await signalWireLamlFetch<{
    sid: string;
    status: string;
  }>(
    `/api/laml/2010-04-01/Accounts/${env.SIGNALWIRE_PROJECT_ID}/Calls.json`,
    params,
  );

  return { callSid: data.sid, status: data.status };
}

export function buildSmsReplyLaml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export function buildTransferLaml(transferTo: string): string {
  const escaped = transferTo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escaped}</Dial></Response>`;
}

export function buildRetellInboundLaml(callId: string): string {
  const safeCallId = callId.replace(/[^a-zA-Z0-9_-]/g, "");
  const destination = `sip:${safeCallId}@sip.retellai.com;transport=tcp`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial><Sip>${destination}</Sip></Dial></Response>`;
}
