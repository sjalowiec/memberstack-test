import type { ViewerAccessState } from "../memberAccess";

export type HelpHubPreviewAudience = "member" | "visitor";

type AudienceRoot = {
  querySelector(selector: string): { getAttribute(name: string): string | null } | null;
};

/** Preview-only audience. Public pages omit the attribute and keep real membership checks. */
export function helpHubPreviewAudienceState(root: AudienceRoot): ViewerAccessState | null {
  const value = root.querySelector("[data-help-hub-preview-audience]")?.getAttribute(
    "data-help-hub-preview-audience",
  );
  if (value === "member") return "memberAccess";
  if (value === "visitor") return "loggedOut";
  return null;
}

export function helpHubPreviewAudienceFromBody(body: unknown): HelpHubPreviewAudience | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = (body as { audience?: unknown }).audience;
  if (value === "member" || value === "visitor") return value;
  return undefined;
}
