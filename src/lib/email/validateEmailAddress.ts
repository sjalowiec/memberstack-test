export function normalizeEmailAddress(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Practical client/server check; not exhaustive RFC validation. */
export function isValidEmailAddress(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
