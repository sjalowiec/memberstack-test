/**
 * Builder ? pattern workspace generation handoff.
 *
 * Mirrors the review page "Build My Pattern" prep so the dedicated workspace can become
 * the first destination after builder completion. Trigger via `?generated=1` or
 * {@link markPatternWorkspaceBuilderHandoff} - builder routing is wired in a later phase.
 */
import { loadExpressSweaterCharts } from "./sleevelessExpressSizeChartClient";
import { flushExpressWizardToCanonicalPattern } from "./flushExpressWizardToCanonicalPattern";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { logCurrentPatternActivity } from "./sleevelessPatternActivity";
import type { PatternSystemId } from "./patternSystemId";

/** Query flag: `/patterns/sleeveless/pattern/?generated=1` */
export const PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY = "generated";

/** Fired after the builder handoff block finishes on the pattern workspace (ran or skipped). */
export const PATTERN_WORKSPACE_BUILDER_HANDOFF_COMPLETE_EVENT =
  "kbm:pattern-workspace-builder-handoff-complete";

/** sessionStorage flag set by {@link markPatternWorkspaceBuilderHandoff}. */
export const PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY =
  "kbm_pattern_workspace_builder_handoff";

/** Pattern system for a generation event — from the workspace URL, not leftover draft state. */
export function resolvePatternSystemFromHandoffHref(href?: string): PatternSystemId {
  try {
    const url = new URL(
      href ?? (typeof window !== "undefined" ? window.location.href : "http://local/"),
    );
    if (/\/patterns\/drop-shoulder(?:\/|$)/.test(url.pathname)) return "drop-shoulder";
    if (/\/patterns\/hat(?:\/|$)/.test(url.pathname)) return "hat";
  } catch {
    /* fall through */
  }
  return "sleeveless";
}

export function markPatternWorkspaceBuilderHandoff(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function readHandoffFromSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function clearHandoffSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PATTERN_WORKSPACE_BUILDER_HANDOFF_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** True when a builder handoff flag is present (query or session). Does not consume. */
export function peekPatternWorkspaceBuilderHandoff(href?: string): boolean {
  if (readHandoffFromSession()) return true;
  try {
    const url = new URL(href ?? (typeof window !== "undefined" ? window.location.href : "http://local/"));
    return url.searchParams.get(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY) === "1";
  } catch {
    return false;
  }
}

/** Remove the handoff query param without reloading. */
export function stripPatternWorkspaceBuilderHandoffFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY)) return;
    url.searchParams.delete(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* ignore */
  }
}

export type RunPatternWorkspaceBuilderGenerationHandoffOptions = {
  root?: ParentNode | null;
  href?: string;
};

/**
 * When a handoff flag is present: flush builder state, prepare generation, log activity,
 * and consume the flag. Returns whether the handoff ran.
 */
export async function runPatternWorkspaceBuilderGenerationHandoff(
  options: RunPatternWorkspaceBuilderGenerationHandoffOptions = {},
): Promise<boolean> {
  if (!peekPatternWorkspaceBuilderHandoff(options.href)) {
    return false;
  }

  const root = options.root ?? (typeof document !== "undefined" ? document : undefined);

  try {
    await loadExpressSweaterCharts();
  } catch {
    console.error("[kbm] Builder handoff: could not load size charts.");
    return false;
  }

  prepareCustomBuildPatternGeneration({ root: root ?? undefined });
  flushExpressWizardToCanonicalPattern();
  logCurrentPatternActivity("pattern_generated", {
    patternSystem: resolvePatternSystemFromHandoffHref(options.href),
  });

  clearHandoffSession();
  stripPatternWorkspaceBuilderHandoffFromUrl();

  return true;
}
