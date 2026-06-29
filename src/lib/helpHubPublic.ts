/** Minimal Help Hub tip fields used for public visibility and search. */
export type HelpHubTipRecord = {
  id?: number | string;
  slug?: string;
  status?: string;
  /** Legacy override; ignored when status is draft or review. */
  active?: boolean;
  title?: string;
  question?: string;
  metaTitle?: string;
  metaDescription?: string;
  hook?: string;
  bubbleAnswer?: string;
  isNew?: boolean;
  mediaUrl?: string;
  videoId?: string | number;
  tags?: string[];
  relatedLessons?: (string | number)[];
};

export type HelpHubVideoRef = {
  content_id?: string | number;
  slug?: string;
};

/** Client-safe search row (no draft/review entries). */
export type HelpHubPublicSearchTip = {
  slug: string;
  title: string;
  question: string;
};

function normalizeHelpHubStatus(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/**
 * Whether a tip may appear on public Help Hub routes, search, or related links.
 * Draft and review entries are never public, even when `active: true`.
 */
export function helpHubTipIsPublic(tip: HelpHubTipRecord): boolean {
  const status = normalizeHelpHubStatus(tip.status);
  if (status === "draft" || status === "review") return false;
  if (typeof tip.active === "boolean") return tip.active;
  return status === "published" || status === "";
}

export function filterPublicHelpHubTips<T extends HelpHubTipRecord>(tips: T[]): T[] {
  return tips.filter(helpHubTipIsPublic);
}

export function findPublicHelpHubTipBySlug<T extends HelpHubTipRecord>(
  tips: T[],
  slug: string,
): T | undefined {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return undefined;
  return filterPublicHelpHubTips(tips).find(
    (t) => typeof t.slug === "string" && t.slug.trim().toLowerCase() === normalized,
  );
}

export function helpHubTipMatchesVideo(tip: HelpHubTipRecord, video: HelpHubVideoRef): boolean {
  const videoSlug = typeof video.slug === "string" ? video.slug.trim().toLowerCase() : "";
  const contentId = video.content_id != null ? String(video.content_id).trim() : "";
  const tipSlug = typeof tip.slug === "string" ? tip.slug.trim().toLowerCase() : "";
  const mediaUrl = typeof tip.mediaUrl === "string" ? tip.mediaUrl.trim().toLowerCase() : "";
  const videoId = tip.videoId != null ? String(tip.videoId).trim() : "";

  if (videoSlug && tipSlug === videoSlug) return true;
  if (videoSlug && mediaUrl === videoSlug) return true;
  if (contentId && videoId === contentId) return true;
  if (contentId && mediaUrl === contentId) return true;
  return false;
}

export function findPublicHelpHubTipsForVideo<T extends HelpHubTipRecord>(
  tips: T[],
  video: HelpHubVideoRef,
): T[] {
  return filterPublicHelpHubTips(tips).filter((t) => helpHubTipMatchesVideo(t, video));
}

function helpHubTipSearchText(tip: HelpHubTipRecord): string {
  const parts = [
    tip.title,
    tip.question,
    tip.metaTitle,
    tip.metaDescription,
    tip.hook,
    tip.bubbleAnswer,
    tip.slug,
    ...(Array.isArray(tip.tags) ? tip.tags : []),
  ];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .toLowerCase();
}

export function searchPublicHelpHubTips<T extends HelpHubTipRecord>(
  tips: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return filterPublicHelpHubTips(tips).filter((t) => helpHubTipSearchText(t).includes(q));
}

export function publicHelpHubTipsForClientSearch(
  tips: HelpHubTipRecord[],
): HelpHubPublicSearchTip[] {
  return filterPublicHelpHubTips(tips)
    .map((tip) => {
      const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
      if (!slug) return null;
      const question = typeof tip.question === "string" ? tip.question.trim() : "";
      const title = typeof tip.title === "string" ? tip.title.trim() : "";
      return { slug, question, title: title || question || slug };
    })
    .filter((row): row is HelpHubPublicSearchTip => row !== null);
}
