/**
 * Stripe webhook signature verification (no Stripe SDK).
 *
 * Header format: `t=<unix_seconds>,v1=<hex>[,v1=...]`
 * Signed payload: `${t}.${rawBody}` HMAC-SHA256 with the endpoint secret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export function readStripeWebhookSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = (env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  return secret || null;
}

function parseStripeSignatureHeader(header: string): {
  timestamp: number | null;
  signatures: string[];
} {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!value) continue;
    if (key === "t") {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n)) timestamp = n;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function hexEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * True when the Stripe-Signature header matches the raw body and secret,
 * and the timestamp is within the tolerance window.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || typeof rawBody !== "string") return false;
  if (typeof signatureHeader !== "string" || !signatureHeader.trim()) return false;

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (timestamp == null || signatures.length === 0) return false;

  if (Math.abs(nowSeconds - timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((signature) => hexEqual(expected, signature));
}

/** Build a Stripe-Signature header for tests. */
export function signStripeWebhookPayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const v1 = hmacSha256Hex(secret, `${timestampSeconds}.${rawBody}`);
  return `t=${timestampSeconds},v1=${v1}`;
}
