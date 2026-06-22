export const LEGACY_ASSET_ORIGIN = "https://www.knititnow.com";
export const LEGACY_DOWNLOAD_BASE = `${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges`;

/** Root-relative paths served from Astro public/ on this site. */
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

export function downloadUrl(filename: string): string {
  return `${LEGACY_DOWNLOAD_BASE}/${filename.replace(/^\//, "")}`;
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
  return html.replace(attrPattern, (_, prefix: string, quote: string, path: string) => {
    return `${prefix}${quote}${legacyAssetUrl(path)}${quote}`;
  });
}

export function rewriteLegacyHtml(html: string): string {
  return rewriteAttributeUrl(
    rewriteAttributeUrl(html, "src", '[^"\']*'),
    "href",
    '[^"\']+\\.pdf',
  );
}
