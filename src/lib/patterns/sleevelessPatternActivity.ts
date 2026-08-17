/**
 * Current-pattern convenience for {@link logPatternActivity}.
 *
 * Resolves `patternSystem` from the working session / page (sleeveless vs drop-shoulder)
 * and derives `patternId` / `patternTitle` / `mode` from the working draft so call sites
 * only pass the event type. Best-effort: never throws, never blocks the flow.
 */
import {
  logPatternActivity,
  type LogPatternActivityInput,
  type PatternActivityEventType,
} from "./patternActivityLog";
import { getCurrentPattern } from "./patternStorage";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  resolvePatternSystemFromPage,
  resolvePatternSystemFromWorkingSession,
  type PatternSystemId,
} from "./patternSystemId";
import { resolveActivityMembershipFromSnapshot } from "./patternActivityIdentity";

type PatternActivityOverrides = Partial<
  Omit<LogPatternActivityInput, "eventType">
>;

export function resolveActivityPatternSystem(
  override?: string,
): PatternSystemId | string {
  const explicit = override?.trim();
  if (explicit) return explicit;
  try {
    return resolvePatternSystemFromWorkingSession();
  } catch {
    return resolvePatternSystemFromPage();
  }
}

function readDraftContext(): {
  patternId?: string;
  patternTitle?: string;
  mode?: string;
} {
  try {
    const pattern = getCurrentPattern();
    const meta = getPatternProjectMeta(pattern);
    const patternMode =
      (pattern.style as { patternMode?: unknown } | undefined)?.patternMode === "express"
        ? "express"
        : "custom";
    return {
      patternId: readActiveCustomPatternProjectId() || pattern.id || undefined,
      patternTitle: meta.title || undefined,
      mode: patternMode,
    };
  } catch {
    return {};
  }
}

/** Fire-and-forget activity event for the current sweater pattern system. */
export function logCurrentPatternActivity(
  eventType: PatternActivityEventType,
  overrides: PatternActivityOverrides = {},
): void {
  const context = readDraftContext();
  void logPatternActivity({
    eventType,
    patternSystem: resolveActivityPatternSystem(overrides.patternSystem),
    patternId: overrides.patternId ?? context.patternId,
    patternTitle: overrides.patternTitle ?? context.patternTitle,
    mode: overrides.mode ?? context.mode,
    sourcePage: overrides.sourcePage,
    userEmail: overrides.userEmail,
    guestEmail: overrides.guestEmail,
    membership: overrides.membership ?? resolveActivityMembershipFromSnapshot(),
    metadata: overrides.metadata,
  });
}

/** @deprecated Prefer {@link logCurrentPatternActivity}. Kept as a stable alias. */
export function logSleevelessPatternActivity(
  eventType: PatternActivityEventType,
  overrides: PatternActivityOverrides = {},
): void {
  logCurrentPatternActivity(eventType, overrides);
}
