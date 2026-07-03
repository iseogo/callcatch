import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { sendSms } from "@/lib/signalwire";

export interface SmsMessage {
  role: "user" | "assistant" | "system";
  content: string;
  sentAt: string;
}

const SMS_SIGNATURE = "\n\n— CallCatch";

export function appendSignature(body: string): string {
  if (body.endsWith(SMS_SIGNATURE.trim())) {
    return body;
  }
  return `${body}${SMS_SIGNATURE}`;
}

export async function getOrCreateSmsThread(
  businessId: string,
  callerPhone: string,
) {
  const normalized = normalizePhone(callerPhone);
  const existing = await prisma.smsThread.findUnique({
    where: {
      businessId_callerPhone: {
        businessId,
        callerPhone: normalized,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.smsThread.create({
    data: {
      businessId,
      callerPhone: normalized,
      messages: [] as Prisma.InputJsonValue,
    },
  });
}

export function parseMessages(messages: Prisma.JsonValue): SmsMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const parsed: SmsMessage[] = [];
  for (const item of messages) {
    if (
      typeof item === "object" &&
      item !== null &&
      "role" in item &&
      "content" in item &&
      "sentAt" in item &&
      typeof (item as { content?: unknown }).content === "string"
    ) {
      parsed.push(item as unknown as SmsMessage);
    }
  }
  return parsed;
}

export async function appendSmsMessage(
  threadId: string,
  message: SmsMessage,
): Promise<SmsMessage[]> {
  const thread = await prisma.smsThread.findUniqueOrThrow({
    where: { id: threadId },
  });
  const history = parseMessages(thread.messages);
  const updated = [...history, message];

  await prisma.smsThread.update({
    where: { id: threadId },
    data: { messages: updated as unknown as Prisma.InputJsonValue },
  });

  return updated;
}

export interface SendThreadSmsInput {
  businessId: string;
  fromNumber: string;
  toPhone: string;
  body: string;
  role?: "assistant" | "system";
  sign?: boolean;
}

/** Load thread, send SMS, persist assistant message. */
export async function sendThreadSms(
  input: SendThreadSmsInput,
): Promise<{ sid: string; history: SmsMessage[] }> {
  const normalized = normalizePhone(input.toPhone);
  const thread = await getOrCreateSmsThread(input.businessId, normalized);
  const body = input.sign === false ? input.body : appendSignature(input.body);

  const result = await sendSms({
    from: input.fromNumber,
    to: normalized,
    body,
  });

  const history = await appendSmsMessage(thread.id, {
    role: input.role ?? "assistant",
    content: body,
    sentAt: new Date().toISOString(),
  });

  return { sid: result.sid, history };
}

export async function recordInboundSms(
  businessId: string,
  callerPhone: string,
  body: string,
): Promise<SmsMessage[]> {
  const thread = await getOrCreateSmsThread(businessId, callerPhone);
  return appendSmsMessage(thread.id, {
    role: "user",
    content: body,
    sentAt: new Date().toISOString(),
  });
}
