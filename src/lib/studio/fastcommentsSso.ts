/**
 * Server-side FastComments Secure SSO.
 * Simple SSO is not used: the browser can forge that payload.
 * The API secret stays in this module's inputs and never in the widget response.
 */
import { createHmac } from "node:crypto";

export type StudioCommentIdentity = {
  email: string | null;
  displayName: string | null;
};

export type SecureSsoWidgetUser = {
  userDataJSONBase64: string;
  verificationHash: string;
  timestamp: number;
};

function text(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function customField(fields: Record<string, unknown> | null, ...keys: string[]): string {
  if (!fields) return "";
  for (const key of keys) {
    const value = text(fields[key]);
    if (value) return value;
  }
  return "";
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** First letter of the last name, uppercased, with a period. "Jalowiec" → "J." */
function lastInitial(lastName: string): string | null {
  const first = Array.from(lastName.trim())[0];
  if (!first || !/\p{L}/u.test(first)) return null;
  return `${first.toLocaleUpperCase("en-US")}.`;
}

/**
 * Public comment name from Memberstack name fields.
 * "Sue" + "Jalowiec" → "Sue J." A first name alone stays "Sue".
 * No first name, an email, or a member id never becomes the display name.
 */
export function formatStudioCommentDisplayName(firstName: string, lastName: string): string | null {
  const first = firstName.trim();
  if (!first || first.includes("@") || first.length > 500) return null;
  const initial = lastInitial(lastName);
  const displayName = initial ? `${first} ${initial}` : first;
  if (displayName.length > 500) return null;
  return displayName;
}

/**
 * Display name from Memberstack name fields only.
 * Custom first/last name wins, then auth first/last.
 * A last name alone, a single name field, an email, or a member id cannot post.
 */
export function studioCommentIdentityFromMemberRecord(member: unknown): StudioCommentIdentity {
  const root = record(member);
  const data = record(root?.data) ?? root;
  if (!data) return { email: null, displayName: null };

  const auth = record(data.auth);
  const fields = record(data.customFields);
  const email = text(auth?.email) || text(data.email) || null;

  const first = customField(fields, "first-name", "firstName") || text(auth?.firstName);
  const last = customField(fields, "last-name", "lastName") || text(auth?.lastName);
  return { email, displayName: formatStudioCommentDisplayName(first, last) };
}

/**
 * HMAC-SHA256 of `timestamp + userDataJSONBase64` (no separator), hex encoded.
 * Matches FastComments' Secure SSO helper: the timestamp is epoch milliseconds.
 */
export function buildSecureSsoWidgetUser(input: {
  id: string;
  email: string;
  displayName: string;
  apiSecret: string;
  timestamp: number;
}): SecureSsoWidgetUser {
  const userDataJSONBase64 = Buffer.from(
    JSON.stringify({
      id: input.id,
      email: input.email,
      username: input.displayName,
      displayName: input.displayName,
    }),
    "utf8",
  ).toString("base64");
  const verificationHash = createHmac("sha256", input.apiSecret)
    .update(`${input.timestamp}${userDataJSONBase64}`)
    .digest("hex");
  return {
    userDataJSONBase64,
    verificationHash,
    timestamp: input.timestamp,
  };
}
