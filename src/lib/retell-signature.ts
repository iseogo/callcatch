import { createHmac, timingSafeEqual } from "crypto";

const RETELL_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const RETELL_SIGNATURE_PATTERN = /^v=(\d+),d=([a-fA-F0-9]{64})$/;

/**
 * Verify Retell's `v=<timestamp>,d=<digest>` webhook signature.
 *
 * Retell signs the exact raw request body concatenated with the timestamp.
 * Rejecting old timestamps also prevents a captured request from being replayed.
 */
export function verifyRetellRequestSignature(
  rawBody: string,
  apiKey: string,
  signature: string,
  nowMs = Date.now(),
): boolean {
  const match = RETELL_SIGNATURE_PATTERN.exec(signature.trim());
  if (!match) {
    return false;
  }

  const [, timestampText, digestHex] = match;
  const timestamp = Number(timestampText);

  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowMs - timestamp) > RETELL_SIGNATURE_MAX_AGE_MS
  ) {
    return false;
  }

  const expected = createHmac("sha256", apiKey)
    .update(rawBody + timestampText)
    .digest();
  const received = Buffer.from(digestHex, "hex");

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}
