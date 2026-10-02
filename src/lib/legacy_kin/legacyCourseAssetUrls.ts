export const LEGACY_ASSET_ORIGIN = "https://www.knititnow.com";
export const LEGACY_DOWNLOAD_BASE = `${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges`;

/** Root-relative paths served from Astro public/ at deploy time (see public/challenge/, public/images/courses/). */
export const LOCAL_PUBLIC_PATH_PREFIXES = [
  "/challenge/",
  "/downloads/",
  "/images/",
  "/docs/",
] as const;

export function isLocalPublicAssetPath(path: string): boolean {
  const trimmed = path.trim();
  return LOCAL_PUBLIC_PATH_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function legacyAssetUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (isLocalPublicAssetPath(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${LEGACY_ASSET_ORIGIN}${trimmed}`;
  return `${LEGACY_ASSET_ORIGIN}/${trimmed.replace(/^\//, "")}`;
}

/** Resolve a download component filename to an href without rewriting stored values. */
export function downloadUrl(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  const rootRelative = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (isLocalPublicAssetPath(rootRelative)) return rootRelative;
  if (trimmed.startsWith("/")) return `${LEGACY_ASSET_ORIGIN}${trimmed}`;
  return `${LEGACY_DOWNLOAD_BASE}/${trimmed.replace(/^\//, "")}`;
}

function rewriteAttributeUrl(
  html: string,
  attribute: "src" | "href",
  valuePattern: string,
): string {
  const attrPattern = new RegExp(
    `(\\s${attribute}=)(["'])(${valuePattern})\\2`,
    "gi",
  );
  return html.replace(
    attrPattern,
    (match: string, prefix: string, quote: string, path: string, offset: number, source: string) => {
      if (attribute === "src" && isSameSiteToolEmbedSrc(source, offset, path)) {
        return match;
      }
      return `${prefix}${quote}${legacyAssetUrl(path)}${quote}`;
    },
  );
}

/** Keep pasted course iframes on this site instead of the legacy image host. */
function isSameSiteToolEmbedSrc(source: string, offset: number, path: string): boolean {
  if (!String(path).trim().startsWith("/tools/")) return false;
  const lookbehind = source.slice(Math.max(0, offset - 240), offset);
  const tagStart = lookbehind.lastIndexOf("<");
  if (tagStart < 0) return false;
  return /^<iframe\b/i.test(lookbehind.slice(tagStart));
}

export function rewriteLegacyHtml(html: string): string {
  return rewriteAttributeUrl(
    rewriteAttributeUrl(html, "src", '[^"\']*'),
    "href",
    '[^"\']+\\.pdf',
  );
}
