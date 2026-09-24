/**
 * One generation event per successful builder completion.
 *
 * The builder sets a session token immediately before navigation. The destination
 * consumes it once. Reloads, back/forward onto `?generated=1`, and opening a
 * saved pattern do not set the token, so they cannot record another generation.
 */
import { logPatternActivity, type LogPatternActivityInput } from "./patternActivityLog";

export const PATTERN_GENERATION_ACTIVITY_SESSION_KEY = "kbm_pattern_generation_activity";

/** Pattern system for an event, taken from the page URL rather than a leftover draft. */
export function patternSystemFromPathname(pathname: string): string {
  const path = pathname.toLowerCase();
  if (path.includes("/patterns/drop-shoulder")) return "drop-shoulder";
  if (path.includes("/patterns/sideways-cardigan")) return "sideways-cardigan";
  if (path.includes("/patterns/hat")) return "hat";
  if (path.includes("/patterns/socks")) return "socks";
  return "sleeveless";
}

type GenerationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultSessionStorage(): GenerationStorage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function markPatternGenerationPending(
  storage: Pick<Storage, "setItem"> | null = defaultSessionStorage(),
): void {
  try {
    storage?.setItem(PATTERN_GENERATION_ACTIVITY_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function peekPatternGenerationPending(
  storage: Pick<Storage, "getItem"> | null = defaultSessionStorage(),
): boolean {
  try {
    return storage?.getItem(PATTERN_GENERATION_ACTIVITY_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Consume the one-shot token. Returns false when it was already used or never set. */
export function takePatternGenerationPending(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = defaultSessionStorage(),
): boolean {
  if (!peekPatternGenerationPending(storage)) return false;
  try {
    storage?.removeItem(PATTERN_GENERATION_ACTIVITY_SESSION_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

export type LogGeneratedPatternOnceInput = Omit<
  LogPatternActivityInput,
  "eventType" | "userId" | "id" | "createdAt"
>;

/**
 * Record `pattern_generated` only when this browser session still holds the
 * builder token. Open, edit, print, and reload do not call the marker.
 */
export async function logGeneratedPatternOnce(
  input: LogGeneratedPatternOnceInput,
  storage?: Pick<Storage, "getItem" | "removeItem"> | null,
): Promise<boolean> {
  if (!takePatternGenerationPending(storage)) return false;
  return logPatternActivity({
    ...input,
    eventType: "pattern_generated",
  });
}
