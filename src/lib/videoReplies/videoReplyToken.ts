import { randomBytes } from "node:crypto";

/** Cryptographically strong, URL-safe public token (not derived from PII or sequential IDs). */
export function generateVideoReplyPublicToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Token byte length must be an integer >= 16.");
  }
  return randomBytes(byteLength).toString("base64url");
}

export function isPlausibleVideoReplyPublicToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  // base64url of 16–64 bytes ? roughly 22–86 chars
  if (trimmed.length < 22 || trimmed.length > 96) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}
