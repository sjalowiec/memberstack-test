/**
 * Hat Pattern Activity — one `pattern_generated` per successful builder generation.
 *
 * A session token set by the builder is consumed on the first successful
 * from-builder continue so summary refreshes, edits, and reopenings do not
 * create duplicate generated events.
 */
import { isValidEmailAddress } from "../../email/validateEmailAddress";
import type { ViewerAccessState } from "../../memberAccess";
import { logPatternActivity } from "../patternActivityLog";
import {
  membershipFromViewerAccess,
  type PatternActivityMembership,
} from "../patternActivityIdentity";
import { readHatActiveProjectId, resolveHatSavedPatternName } from "./hatSavedProject";
import { readHatDraft } from "./hatDraft";

export const HAT_GENERATION_ACTIVITY_SESSION_KEY = "kbm_hat_generation_activity";
export const HAT_ACTIVITY_EMAIL_KEY = "kbm_hat_activity_email";

export function markHatGenerationActivityPending(
  storage: Pick<Storage, "setItem"> | null = defaultSessionStorage(),
): void {
  try {
    storage?.setItem(HAT_GENERATION_ACTIVITY_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function peekHatGenerationActivityPending(
  storage: Pick<Storage, "getItem"> | null = defaultSessionStorage(),
): boolean {
  try {
    return storage?.getItem(HAT_GENERATION_ACTIVITY_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Consume the one-shot generation token. Returns false when already used or missing. */
export function takeHatGenerationActivityPending(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = defaultSessionStorage(),
): boolean {
  if (!peekHatGenerationActivityPending(storage)) return false;
  try {
    storage?.removeItem(HAT_GENERATION_ACTIVITY_SESSION_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

export function rememberHatActivityEmail(
  email: string,
  storage: Pick<Storage, "setItem"> | null = defaultLocalStorage(),
  session: Pick<Storage, "setItem"> | null = defaultSessionStorage(),
): void {
  const trimmed = email.trim();
  if (!trimmed || !isValidEmailAddress(trimmed)) return;
  try {
    session?.setItem(HAT_ACTIVITY_EMAIL_KEY, trimmed);
  } catch {
    /* ignore */
  }
  try {
    storage?.setItem(HAT_ACTIVITY_EMAIL_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export function readHatActivityEmail(
  storage: Pick<Storage, "getItem"> | null = defaultLocalStorage(),
  session: Pick<Storage, "getItem"> | null = defaultSessionStorage(),
): string | undefined {
  try {
    const fromSession = session?.getItem(HAT_ACTIVITY_EMAIL_KEY)?.trim();
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = storage?.getItem(HAT_ACTIVITY_EMAIL_KEY)?.trim();
    return fromLocal || undefined;
  } catch {
    return undefined;
  }
}

function defaultSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function defaultLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function hatActivityMembership(
  state: ViewerAccessState | null | undefined,
): PatternActivityMembership {
  return membershipFromViewerAccess(state);
}

export type LogHatPatternGeneratedInput = {
  viewerAccessState: ViewerAccessState;
  guestEmail?: string;
  patternTitle?: string;
  patternId?: string;
  sourcePage?: string;
  /** Test seam — skip the one-shot token (token is still the production gate). */
  force?: boolean;
};

function resolveHatActivityTitle(explicit?: string): string | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  try {
    const draft = readHatDraft();
    return resolveHatSavedPatternName(draft) || undefined;
  } catch {
    return undefined;
  }
}

function resolveHatActivityPatternId(explicit?: string): string | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  try {
    return readHatActiveProjectId() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Record one Hat `pattern_generated` event after a successful from-builder continue.
 * No-ops when the builder token is missing (refresh / edit / reopen).
 */
export async function logHatPatternGenerated(
  input: LogHatPatternGeneratedInput,
): Promise<boolean> {
  if (!input.force && !takeHatGenerationActivityPending()) {
    return false;
  }

  const membership = hatActivityMembership(input.viewerAccessState);
  const guestEmail = input.guestEmail?.trim() || readHatActivityEmail();
  const loggedIn =
    input.viewerAccessState === "memberAccess" ||
    input.viewerAccessState === "loggedInNoAccess";

  return logPatternActivity({
    eventType: "pattern_generated",
    patternSystem: "hat",
    patternId: resolveHatActivityPatternId(input.patternId),
    patternTitle: resolveHatActivityTitle(input.patternTitle),
    sourcePage: input.sourcePage ?? "/patterns/hat/summary/",
    membership,
    guestEmail: loggedIn ? undefined : guestEmail,
    userEmail: guestEmail,
  });
}
