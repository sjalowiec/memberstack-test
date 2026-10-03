import { findToolByRequestPath, toolRequestPath } from "../tools/toolMembership";

/**
 * Catalog tools mounted inside the Help Hub modal.
 * Other related links stay normal navigation.
 */
const HELP_HUB_MODAL_TOOL_PATHS = new Set(["/tools/band-pickup"]);

export type HelpHubRelatedToolModal = {
  title: string;
  toolPath: string;
};

export function helpHubRelatedToolModal(href: string): HelpHubRelatedToolModal | null {
  const tool = findToolByRequestPath(href);
  if (!tool) return null;
  const toolPath = toolRequestPath(typeof tool.href === "string" ? tool.href : "");
  if (!HELP_HUB_MODAL_TOOL_PATHS.has(toolPath)) return null;
  const title = typeof tool.title === "string" ? tool.title.trim() : "";
  if (!title) return null;
  return { title, toolPath };
}

/** Public Help Hub entry to restore after a login that leaves the page. */
export function helpHubToolLoginReturnPath(slug: string | null | undefined): string {
  const trimmed = typeof slug === "string" ? slug.trim() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(trimmed)) return "";
  return `/help-hub/${trimmed}`;
}

/** Safe fragment for element ids when several tips are on one page. */
export function helpHubToolDomId(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "help-hub-tool";
}
