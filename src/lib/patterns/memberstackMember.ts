/** Shared Memberstack member payload parsing (client-side). */

export function memberIdFromMemberstackPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const id = data.id ?? data._id;
  if (typeof id === "string" && id.trim()) return id.trim();
  const auth = data.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const authId = (auth as Record<string, unknown>).id;
    if (typeof authId === "string" && authId.trim()) return authId.trim();
  }
  return undefined;
}

export function isMemberstackLoggedInPayload(payload: unknown): boolean {
  return Boolean(memberIdFromMemberstackPayload(payload));
}

function memberstackDataRecord(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  return data;
}

/** Member object from a `getCurrentMember()` payload (`data.member` or `data`). */
export function memberRecordFromMemberstackPayload(payload: unknown): Record<string, unknown> | undefined {
  const data = memberstackDataRecord(payload);
  if (!data) return undefined;
  const nested = data.member;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return data;
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function customFieldString(customFields: unknown, ...keys: string[]): string | undefined {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return undefined;
  const fields = customFields as Record<string, unknown>;
  for (const key of keys) {
    const value = trimmedString(fields[key]);
    if (value) return value;
  }
  return undefined;
}

/** Best-effort member email from a `getCurrentMember()` payload (`data.auth.email` / `data.email`). */
export function memberEmailFromMemberstackPayload(payload: unknown): string | undefined {
  const data = memberstackDataRecord(payload);
  if (!data) return undefined;
  const auth = data.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const authEmail = trimmedString((auth as Record<string, unknown>).email);
    if (authEmail) return authEmail;
  }
  const member = memberRecordFromMemberstackPayload(payload);
  const memberAuth = member?.auth;
  if (memberAuth && typeof memberAuth === "object" && !Array.isArray(memberAuth)) {
    const memberAuthEmail = trimmedString((memberAuth as Record<string, unknown>).email);
    if (memberAuthEmail) return memberAuthEmail;
  }
  return trimmedString(data.email) ?? trimmedString(member?.email);
}

/**
 * First name from Memberstack (trimmed).
 * Prefers custom fields (`first-name` / `firstName`), then `auth.firstName`.
 * Does not fall back to email or username.
 */
export function memberFirstNameFromMemberstackPayload(payload: unknown): string | undefined {
  const member = memberRecordFromMemberstackPayload(payload);
  if (!member) return undefined;
  const fromCustom = customFieldString(member.customFields, "first-name", "firstName");
  if (fromCustom) return fromCustom;
  const auth = member.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    return trimmedString((auth as Record<string, unknown>).firstName);
  }
  return undefined;
}

/** Display first name with email local-part fallback (before `@`). */
export function memberDisplayFirstNameFromMemberstackPayload(payload: unknown): string | undefined {
  const firstName = memberFirstNameFromMemberstackPayload(payload);
  if (firstName) return firstName;
  const email = memberEmailFromMemberstackPayload(payload);
  if (!email) return undefined;
  const localPart = email.split("@")[0]?.trim();
  return localPart || undefined;
}

/** Account welcome greeting — includes name when available. */
export function accountWelcomeGreetingFromMemberstackPayload(payload: unknown): string {
  const firstName = memberDisplayFirstNameFromMemberstackPayload(payload);
  return firstName ? `Welcome back, ${firstName}` : "Welcome back";
}
