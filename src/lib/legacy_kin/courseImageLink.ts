/** Optional click-through URL for course image elements. */

export function linkUrlHasContent(linkUrl: unknown): boolean {
  return String(linkUrl ?? "").trim().length > 0;
}

export function normalizeLinkUrl(linkUrl: unknown): string | undefined {
  const trimmed = String(linkUrl ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isExternalLinkUrl(linkUrl: string): boolean {
  return /^https?:\/\//i.test(linkUrl.trim());
}

export type CourseImageLinkAttrs = {
  href: string;
  target?: string;
  rel?: string;
};

export function courseImageLinkAttrs(linkUrl: unknown): CourseImageLinkAttrs | null {
  const href = normalizeLinkUrl(linkUrl);
  if (!href) return null;
  if (isExternalLinkUrl(href)) {
    return { href, target: "_blank", rel: "noopener noreferrer" };
  }
  return { href };
}
