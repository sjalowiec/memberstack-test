/**
 * Tip of the Week — catalog video resolution + legacy JSON helpers.
 *
 * Featured tip content for production is managed in Watson Postgres
 * (`src/lib/tipOfTheWeek/`). This module still:
 * - resolves Learning Library videos from `videos-public.json`
 * - exposes the JSON config as an explicit **dev-only** fallback source
 *   (`TIP_OF_THE_WEEK_DEV_JSON=true` via `publicPage.ts`)
 */
import tipConfig from "../data/tip-of-the-week.json";
import videosPublic from "../data/videos-public.json";
import type { TipRelatedResource } from "./tipOfTheWeek/types";

export type TipRelatedLink = TipRelatedResource;

export type TipOfTheWeekConfig = {
  tipId: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Optional glossary slug or phrase for the first intro tooltip. */
  introGlossarySlug?: string;
  availabilityNotice: string;
  /** ISO date (YYYY-MM-DD) — available-from for the free window (LA calendar). */
  availableFrom?: string;
  /** ISO date (YYYY-MM-DD) — single source for all “available through” copy. */
  availableThrough: string;
  videoContentId: number | string;
  videoTitle: string;
  learnHeading: string;
  learnPoints: string[];
  tryHeading: string;
  tryCopy: string;
  sueTipHeading: string;
  sueTipCopy: string;
  /** Optional public CTA button label. */
  ctaText?: string;
  /** Optional public CTA destination (site path or https:// URL). */
  ctaUrl?: string;
  relatedHeading: string;
  relatedLinks: TipRelatedResource[];
  availabilityFooterTemplate: string;
};

export type TipCatalogVideo = {
  contentId: string;
  slug: string;
  catalogTitle: string;
  vimeoId: string;
  posterUrl: string;
  accessLevel: string;
};

type PublicVideoRow = {
  content_id?: string | number;
  slug?: string;
  title?: string;
  vimeo_id?: string | number;
  vimeo_id_public?: string | number;
  posterUrl?: string;
  poster_url?: string;
  access_level?: string;
};

/**
 * Dev/seed JSON only. Production public page loads Watson via
 * `loadPublicTipOfTheWeekPage` — do not treat this export as live content.
 */
export const tipOfTheWeek = tipConfig as TipOfTheWeekConfig;

/** Format the shared `availableThrough` ISO date for display (e.g. August 14, 2026). */
export function formatTipAvailabilityDate(
  isoDate: string = tipOfTheWeek.availableThrough,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return String(isoDate || "").trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return String(isoDate).trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Footer sentence using the single `availableThrough` config value. */
export function tipAvailabilityFooter(
  config: TipOfTheWeekConfig = tipOfTheWeek,
): string {
  const date = formatTipAvailabilityDate(config.availableThrough);
  return config.availabilityFooterTemplate.replace("{date}", date);
}

function contentIdKey(value: string | number | undefined): string {
  return String(value ?? "").trim();
}

/** Resolve a Learning Library row (Vimeo id + poster) by content_id. */
export function resolveTipCatalogVideo(
  config: { videoContentId: number | string } = tipOfTheWeek,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): TipCatalogVideo | null {
  const wanted = contentIdKey(config.videoContentId);
  if (!wanted) return null;

  const row = catalog.find((v) => contentIdKey(v.content_id) === wanted);
  if (!row) return null;

  const vimeoRaw = row.vimeo_id_public ?? row.vimeo_id;
  const vimeoId = vimeoRaw != null ? String(vimeoRaw).trim() : "";
  if (!/^\d+$/.test(vimeoId)) return null;

  const posterUrl =
    (typeof row.posterUrl === "string" && row.posterUrl.trim()) ||
    (typeof row.poster_url === "string" && row.poster_url.trim()) ||
    "";

  return {
    contentId: contentIdKey(row.content_id),
    slug: String(row.slug || "").trim(),
    catalogTitle: String(row.title || "").trim(),
    vimeoId,
    posterUrl,
    accessLevel: String(row.access_level || "").trim() || "member",
  };
}
