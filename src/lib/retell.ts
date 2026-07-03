import { env, requireLiveCredentials } from "@/env";
import { RetellApiError } from "@/lib/errors";
import { verifyRetellRequestSignature } from "@/lib/retell-signature";
import { withRetry } from "@/lib/retry";

const RETELL_BASE_URL = "https://api.retellai.com";

export type RetellWebhookEvent =
  | "call_started"
  | "call_ended"
  | "call_analyzed"
  | "transcript_updated"
  | "transfer_started"
  | "transfer_bridged"
  | "transfer_cancelled"
  | "transfer_ended";

export interface RetellCallAnalysis {
  call_summary?: string;
  user_sentiment?: string;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, unknown>;
}

export interface RetellCall {
  call_id: string;
  agent_id?: string;
  call_type?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  call_status?: string;
  metadata?: Record<string, unknown>;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  call_analysis?: RetellCallAnalysis;
}

export interface RetellWebhookPayload {
  event: RetellWebhookEvent;
  call: RetellCall;
}

export interface CreateRetellLlmInput {
  general_prompt: string;
  begin_message?: string;
  model?: string;
  start_speaker?: "agent" | "user";
  general_tools?: Array<Record<string, unknown>>;
  post_call_analysis_data?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "enum";
    description: string;
    examples?: string[];
    choices?: string[];
  }>;
}

export interface RetellLlmResponse {
  llm_id: string;
  version?: number;
}

export interface CreateRetellAgentInput {
  llm_id: string;
  agent_name: string;
  voice_id: string;
  webhook_url?: string;
  webhook_events?: RetellWebhookEvent[];
}

export interface RetellAgentResponse {
  agent_id: string;
  agent_name?: string;
}

export interface ImportPhoneNumberInput {
  phone_number: string;
  termination_uri: string;
  sip_trunk_auth_username?: string;
  sip_trunk_auth_password?: string;
  inbound_agents?: Array<{ agent_id: string; weight: number }>;
  inbound_webhook_url?: string;
}

export interface RetellPhoneNumberResponse {
  phone_number: string;
  phone_number_pretty?: string;
  inbound_agent_id?: string;
}

async function retellFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  requireLiveCredentials("retell");

  const response = await withRetry(async () => {
    const res = await fetch(`${RETELL_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new RetellApiError(
        `Retell API ${path} failed: ${res.status} ${body}`,
        res.status,
      );
    }

    return res;
  });

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function mockId(prefix: string): string {
  return `${prefix}_mock_${Date.now().toString(36)}`;
}

export async function createRetellLlm(
  input: CreateRetellLlmInput,
): Promise<RetellLlmResponse> {
  if (env.MOCK_MODE) {
    return { llm_id: mockId("llm"), version: 0 };
  }

  return retellFetch<RetellLlmResponse>("/create-retell-llm", {
    method: "POST",
    body: JSON.stringify({
      model: input.model ?? "gpt-4.1-mini",
      start_speaker: input.start_speaker ?? "agent",
      begin_message: input.begin_message,
      general_prompt: input.general_prompt,
      general_tools: input.general_tools,
      post_call_analysis_data: input.post_call_analysis_data,
    }),
  });
}

export async function updateRetellLlm(
  llmId: string,
  input: Partial<CreateRetellLlmInput>,
): Promise<RetellLlmResponse> {
  if (env.MOCK_MODE) {
    return { llm_id: llmId, version: 1 };
  }

  return retellFetch<RetellLlmResponse>(`/update-retell-llm/${llmId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function createRetellAgent(
  input: CreateRetellAgentInput,
): Promise<RetellAgentResponse> {
  if (env.MOCK_MODE) {
    return { agent_id: mockId("agent"), agent_name: input.agent_name };
  }

  return retellFetch<RetellAgentResponse>("/create-agent", {
    method: "POST",
    body: JSON.stringify({
      response_engine: {
        type: "retell-llm",
        llm_id: input.llm_id,
        version: 0,
      },
      agent_name: input.agent_name,
      voice_id: input.voice_id,
      webhook_url: input.webhook_url,
      webhook_events: input.webhook_events ?? [
        "call_started",
        "call_ended",
        "call_analyzed",
      ],
    }),
  });
}

export async function importRetellPhoneNumber(
  input: ImportPhoneNumberInput,
): Promise<RetellPhoneNumberResponse> {
  if (env.MOCK_MODE) {
    return {
      phone_number: input.phone_number,
      phone_number_pretty: input.phone_number,
      inbound_agent_id: input.inbound_agents?.[0]?.agent_id,
    };
  }

  return retellFetch<RetellPhoneNumberResponse>("/import-phone-number", {
    method: "POST",
    body: JSON.stringify({
      phone_number: input.phone_number,
      termination_uri: input.termination_uri,
      sip_trunk_auth_username: input.sip_trunk_auth_username,
      sip_trunk_auth_password: input.sip_trunk_auth_password,
      inbound_agents: input.inbound_agents,
      inbound_webhook_url: input.inbound_webhook_url,
    }),
  });
}

export async function updateRetellPhoneNumber(
  phoneNumber: string,
  input: Partial<ImportPhoneNumberInput>,
): Promise<RetellPhoneNumberResponse> {
  if (env.MOCK_MODE) {
    return {
      phone_number: phoneNumber,
      inbound_agent_id: input.inbound_agents?.[0]?.agent_id,
    };
  }

  return retellFetch<RetellPhoneNumberResponse>(
    `/update-phone-number/${encodeURIComponent(phoneNumber)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

/** Verify Retell webhook signature (x-retell-signature). */
export function verifyRetellWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (env.MOCK_MODE) {
    return true;
  }

  if (!signature || !env.RETELL_API_KEY) {
    return false;
  }

  return verifyRetellRequestSignature(
    rawBody,
    env.RETELL_API_KEY,
    signature,
  );
}
