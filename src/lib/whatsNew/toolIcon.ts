import toolsData from "../../../data/tools.json";
import { asString, slugFromHref, type ToolRecord } from "../tools/toolAdminFields";

/** Public directory that serves registered tool icons. */
const TOOL_ICON_BASE = "/icons/tools/";

/** Allowed local raster/vector icon extensions. */
const SAFE_ICON_FILENAME = /^[a-z0-9][a-z0-9._-]*\.(svg|png|jpe?g|webp|gif)$/i;

export type WhatsNewToolIconInput = {
  category: string;
  destinationUrl?: string | null;
};

/**
 * True only for a bare, local icon filename that is safe to serve from
 * `/icons/tools/`. Rejects external URLs, protocol-relative URLs, data URIs,
 * path segments, and directory traversal so an icon can never point off-site.
 */
export function isValidLocalToolIcon(icon: unknown): boolean {
  const name = asString(icon).trim();
  if (!name) return false;
  if (/[\\/]/.test(name)) return false; // no path segments / protocol-relative
  if (name.includes("..")) return false; // no directory traversal
  if (/^[a-z][a-z0-9+.-]*:/i.test(name)) return false; // no scheme (http:, data:, …)
  return SAFE_ICON_FILENAME.test(name);
}

/** Strip query/hash so URLs like `/tools/slope?x=1` still match their slug. */
function toolUrlSlug(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? "";
  return slugFromHref(path);
}

/**
 * Resolve the registered tool icon for a What's New card against a catalog.
 *
 * Returns a local `/icons/tools/…` path when the card is a tool linking to a
 * registered tool with a valid local icon, otherwise `null`. Exported with an
 * injectable catalog so behavior can be unit-tested without touching disk.
 */
export function resolveToolIconFromCatalog(
  card: WhatsNewToolIconInput,
  catalog: ToolRecord[] = toolsData as ToolRecord[],
): string | null {
  if (card.category !== "tool") return null;

  const url = asString(card.destinationUrl).trim();
  // Only site-relative destinations can map to a registered local tool.
  if (!url.startsWith("/") || url.startsWith("//")) return null;

  const slug = toolUrlSlug(url);
  if (!slug) return null;

  for (const tool of catalog) {
    if (slugFromHref(tool.href) !== slug) continue;
    const icon = asString(tool.icon).trim();
    if (!isValidLocalToolIcon(icon)) return null;
    return `${TOOL_ICON_BASE}${icon}`;
  }

  return null;
}

/**
 * Resolve the registered tool icon for a public What's New card from the
 * canonical `data/tools.json` catalog. Never stores or reads icons from the
 * What's New database; icons live only in the tools catalog.
 */
export function resolveWhatsNewToolIcon(card: WhatsNewToolIconInput): string | null {
  return resolveToolIconFromCatalog(card);
}
