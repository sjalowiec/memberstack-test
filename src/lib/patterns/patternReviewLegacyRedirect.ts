import { PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY } from "./patternWorkspaceBuilderGenerationHandoff";

export const SLEEVELESS_REVIEW_LEGACY_PATH = "/patterns/sleeveless/review";
export const DROP_SHOULDER_REVIEW_LEGACY_PATH = "/patterns/drop-shoulder/review";

/** Normalize pattern workspace paths to the trailing-slash form used across the app. */
function normalizeWorkspacePath(workspacePath: string): string {
  const trimmed = String(workspacePath ?? "").trim();
  if (!trimmed) return "/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/**
 * Legacy review / express-measurements URLs ? dedicated pattern workspace with builder handoff.
 * Preserves existing query params (e.g. express builder fallbacks) and ensures `generated=1`.
 */
export function buildPatternReviewLegacyRedirect(
  requestUrl: string,
  workspacePath: string,
): string {
  const url = new URL(requestUrl);
  url.pathname = normalizeWorkspacePath(workspacePath);
  if (url.searchParams.get(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY) !== "1") {
    url.searchParams.set(PATTERN_WORKSPACE_BUILDER_HANDOFF_QUERY, "1");
  }
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}`;
}
