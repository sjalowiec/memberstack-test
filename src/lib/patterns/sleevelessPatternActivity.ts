/**
 * Sleeveless-specific convenience for {@link logPatternActivity}.
 *
 * Derives `patternId` / `patternTitle` / `mode` from the working draft (and active saved-project
 * link) so call sites only pass the event type. Best-effort: never throws, never blocks the flow.
 */
import {
  logPatternActivity,
  type LogPatternActivityInput,
  type PatternActivityEventType,
} from "./patternActivityLog";
import { getCurrentPattern } from "./patternStorage";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";

const SLEEVELESS_SYSTEM = "sleeveless";

type SleevelessActivityOverrides = Partial<
  Omit<LogPatternActivityInput, "eventType" | "patternSystem">
>;

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

/** Fire-and-forget sleeveless activity event. Resolves draft context unless overridden. */
export function logSleevelessPatternActivity(
  eventType: PatternActivityEventType,
  overrides: SleevelessActivityOverrides = {},
): void {
  const context = readDraftContext();
  void logPatternActivity({
    eventType,
    patternSystem: SLEEVELESS_SYSTEM,
    patternId: overrides.patternId ?? context.patternId,
    patternTitle: overrides.patternTitle ?? context.patternTitle,
    mode: overrides.mode ?? context.mode,
    sourcePage: overrides.sourcePage,
    metadata: overrides.metadata,
  });
}
