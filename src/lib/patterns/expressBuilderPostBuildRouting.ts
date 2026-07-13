import {
  PATTERN_WORKSPACE_EDIT_QUERY,
  PATTERN_WORKSPACE_GENERATED_QUERY,
} from "./customPatternProjectNavigation";

/**
 * Where the express builder sends the knitter after gauge submit.
 *
 * - Paid members (`hasSystemAccess`): pattern workspace with builder handoff plus the in-place
 *   Summary/Edit workspace auto-opened (`?generated=1&edit=1`).
 * - Everyone else: pattern workspace with builder handoff only (`?generated=1`).
 */
export function resolveExpressBuilderPostBuildHref(
  baseGeneratedHref: string,
  hasSystemAccess: boolean,
): string {
  const trimmed = baseGeneratedHref.trim();
  if (!trimmed) {
    return hasSystemAccess
      ? `/patterns/sleeveless/pattern/?${PATTERN_WORKSPACE_GENERATED_QUERY}&${PATTERN_WORKSPACE_EDIT_QUERY}`
      : `/patterns/sleeveless/pattern/?${PATTERN_WORKSPACE_GENERATED_QUERY}`;
  }
  if (!hasSystemAccess) return trimmed;

  try {
    const url = new URL(trimmed, "http://local");
    url.searchParams.set("edit", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const sep = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${sep}${PATTERN_WORKSPACE_EDIT_QUERY}`;
  }
}
