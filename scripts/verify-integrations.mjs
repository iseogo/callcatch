/**
 * One-off integration smoke tests. Loads .env.local (names only in output).
 * Usage: node scripts/verify-integrations.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] ??= val;
  }
}

function spaceBaseUrl() {
  let url = process.env.SIGNALWIRE_SPACE_URL ?? "";
  if (!url.startsWith("http")) url = `https://${url}`;
  return url.replace(/\/$/, "");
}

async function testRetell() {
  const key = process.env.RETELL_API_KEY;
  if (!key) return { ok: false, error: "RETELL_API_KEY not set" };

  const res = await fetch("https://api.retellai.com/list-agents", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  }
  let agents;
  try {
    agents = JSON.parse(body);
  } catch {
    return { ok: false, error: `Invalid JSON: ${body.slice(0, 200)}` };
  }
  const count = Array.isArray(agents) ? agents.length : 0;
  return {
    ok: true,
    detail: `Listed ${count} agent(s)`,
    agents: Array.isArray(agents)
      ? agents.map((a) => ({ agent_id: a.agent_id, agent_name: a.agent_name }))
      : [],
  };
}

async function testSignalWire() {
  const projectId = process.env.SIGNALWIRE_PROJECT_ID;
  const token = process.env.SIGNALWIRE_API_TOKEN;
  if (!projectId || !token) {
    return { ok: false, error: "SignalWire credentials not set" };
  }

  const auth = Buffer.from(`${projectId}:${token}`).toString("base64");
  const base = spaceBaseUrl();
  const url = `${base}/api/laml/2010-04-01/Accounts/${projectId}/AvailablePhoneNumbers/US/Local.json?AreaCode=402&PageSize=3`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return { ok: false, error: `Invalid JSON: ${body.slice(0, 200)}` };
  }
  const numbers = data.available_phone_numbers ?? [];
  return {
    ok: true,
    detail: `Found ${numbers.length} available number(s) in area code 402`,
    sample: numbers.slice(0, 3).map((n) => n.phone_number),
  };
}

async function testGoogleFreeBusy() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken =
    process.env.GOOGLE_TEST_REFRESH_TOKEN ??
    process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_TEST_CALENDAR_ID ?? "primary";

  if (!clientId || !clientSecret) {
    return { ok: false, error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set" };
  }
  if (!refreshToken) {
    return {
      ok: false,
      error:
        "No refresh token for FreeBusy test. Set GOOGLE_TEST_REFRESH_TOKEN in .env.local (per-business tokens live in calendarConfig at provisioning time).",
    };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenBody = await tokenRes.text();
  if (!tokenRes.ok) {
    return { ok: false, error: `Token refresh HTTP ${tokenRes.status}: ${tokenBody}` };
  }
  const { access_token: accessToken } = JSON.parse(tokenBody);

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString();

  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: "America/Chicago",
      items: [{ id: calendarId }],
    }),
  });
  const fbBody = await fbRes.text();
  if (!fbRes.ok) {
    return { ok: false, error: `FreeBusy HTTP ${fbRes.status}: ${fbBody}` };
  }
  const fb = JSON.parse(fbBody);
  const busy = fb.calendars?.[calendarId]?.busy ?? [];
  return {
    ok: true,
    detail: `FreeBusy OK for calendarId=${calendarId}; ${busy.length} busy block(s) in next 7 days`,
  };
}

loadEnvLocal();

const results = {
  retell: await testRetell(),
  signalwire: await testSignalWire(),
  google: await testGoogleFreeBusy(),
};

console.log(JSON.stringify(results, null, 2));
