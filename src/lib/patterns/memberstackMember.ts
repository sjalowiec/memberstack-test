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

/** Best-effort member email from a `getCurrentMember()` payload (`data.auth.email` / `data.email`). */
export function memberEmailFromMemberstackPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const auth = data.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const authEmail = (auth as Record<string, unknown>).email;
    if (typeof authEmail === "string" && authEmail.trim()) return authEmail.trim();
  }
  const email = data.email;
  if (typeof email === "string" && email.trim()) return email.trim();
  return undefined;
}
