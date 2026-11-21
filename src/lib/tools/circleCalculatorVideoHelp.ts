/**
 * Circle Calculator technique videos.
 * Catalog content ids. Titles, descriptions, posters, and playback access
 * come from the catalog row. A missing row is omitted. Another video is never substituted.
 *
 * Learning order follows the calculator's constructions:
 * decreased wedges (the default), increased wedges, then the one-piece short-row pinwheel.
 *
 * Member videos do not include a Vimeo id in the page. The client asks
 * `catalog-video-embed` after membership is confirmed, then opens KinCatalogVideoModal.
 */
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import { vimeoNumericIdFromPublicVideo } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import { catalogVideoIsPublic } from "../videoPublic";
import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { gatedVimeoEmbedDelivery } from "../videos/gatedVimeoEmbedDelivery";
import { videoDescriptionPlainText } from "../videos/videoDescriptionHtml";

export const CIRCLE_CALCULATOR_VIDEO_HELP_HEADING = "Knitting circles: Video help";
export const CIRCLE_CALCULATOR_VIDEO_HELP_SECTION_ID = "circle-video-help";

/** Decreased wedges, increased wedges, then short-row pinwheel. */
export const CIRCLE_CALCULATOR_VIDEO_HELP_CONTENT_IDS = [659, 660, 658] as const;

export type CircleCalculatorVideoHelpCard = {
  contentId: number;
  title: string;
  description: string;
  posterUrl: string;
  access: "open" | "member";
};

type CatalogRow = PublicVideoRow & {
  description?: string;
  summary?: string;
  posterUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function posterUrlFromRow(row: CatalogRow): string {
  const url = typeof row.posterUrl === "string" ? row.posterUrl.trim() : "";
  if (!url.startsWith("https://") && !url.startsWith("/")) return "";
  return url;
}

export function resolveCircleCalculatorVideoHelp(
  catalog: CatalogRow[] = videosPublic as CatalogRow[],
): CircleCalculatorVideoHelpCard[] {
  const cards: CircleCalculatorVideoHelpCard[] = [];
  for (const contentId of CIRCLE_CALCULATOR_VIDEO_HELP_CONTENT_IDS) {
    const row = findPublicVideoByContentId(catalog, contentId);
    if (!row || !catalogVideoIsPublic(row)) continue;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const posterUrl = posterUrlFromRow(row);
    if (!title || !posterUrl || !vimeoNumericIdFromPublicVideo(row)) continue;
    const description = videoDescriptionPlainText(
      typeof row.description === "string" && row.description.trim()
        ? row.description
        : typeof row.summary === "string"
          ? row.summary
          : "",
    );
    cards.push({
      contentId,
      title,
      description,
      posterUrl,
      access: catalogVideoPlaybackAccess(row),
    });
  }
  return cards;
}

const PLAY_ICON =
  `<span class="tip-play video-thumb__play" aria-hidden="true">` +
  `<svg viewBox="0 0 68 68" class="tip-play__icon" focusable="false">` +
  `<circle cx="34" cy="34" r="34"></circle>` +
  `<polygon points="28,22 28,46 48,34"></polygon>` +
  `</svg></span>`;

function cardHtml(
  card: CircleCalculatorVideoHelpCard,
  options: { videoDevBypass: boolean },
): string {
  const delivery = gatedVimeoEmbedDelivery({
    accessLevel: card.access,
    videoId: options.videoDevBypass || card.access === "open" ? lookupVimeoId(card.contentId) : "",
    contentId: String(card.contentId),
    videoDevBypass: options.videoDevBypass,
  });
  const exposePlayer = Boolean(delivery.videoIdAttr);
  const modalClass = exposePlayer ? " kbm-kin-catalog-video" : "";
  const vimeoAttr = exposePlayer
    ? ` data-vimeo-id="${escapeHtml(delivery.videoIdAttr ?? "")}" data-vimeo-defer`
    : "";
  const lock =
    card.access === "member" && !exposePlayer
      ? `<span class="kbm-lock-overlay" data-circle-video-lock aria-hidden="true"><i class="fa-solid fa-lock"></i></span>`
      : "";
  const disabled = card.access === "member" && !exposePlayer ? ` aria-disabled="true"` : "";
  const description = card.description
    ? `<span class="circle-video-help__desc">${escapeHtml(card.description)}</span>`
    : "";
  return (
    `<button type="button" class="circle-video-help__card kbm-card video-card${modalClass}"` +
    ` data-circle-video-help` +
    ` data-content-id="${card.contentId}"` +
    ` data-access-level="${card.access}"` +
    ` data-video-title="${escapeHtml(card.title)}"${vimeoAttr}${disabled}` +
    ` aria-haspopup="dialog">` +
    `<span class="video-thumb kbm-card-thumb">` +
    `<img src="${escapeHtml(card.posterUrl)}" alt="" loading="lazy" />` +
    PLAY_ICON +
    lock +
    `</span>` +
    `<span class="kbm-card-body">` +
    `<span class="circle-video-help__title">${escapeHtml(card.title)}</span>` +
    description +
    `</span>` +
    `</button>`
  );
}

function lookupVimeoId(contentId: number): string {
  const row = findPublicVideoByContentId(videosPublic as CatalogRow[], contentId);
  return row ? vimeoNumericIdFromPublicVideo(row) ?? "" : "";
}

export function renderCircleCalculatorVideoHelpSectionHtml(
  cards: CircleCalculatorVideoHelpCard[] = resolveCircleCalculatorVideoHelp(),
  options: { videoDevBypass?: boolean } = {},
): string {
  if (cards.length === 0) return "";
  const videoDevBypass = options.videoDevBypass === true;
  const unlocked = videoDevBypass ? " is-unlocked" : "";
  const buttons = cards.map((card) => cardHtml(card, { videoDevBypass })).join("");
  return (
    `<section id="${CIRCLE_CALCULATOR_VIDEO_HELP_SECTION_ID}" class="circle-video-help no-print${unlocked}"` +
    ` data-circle-video-help-section aria-labelledby="circle-video-help-heading" tabindex="-1">` +
    `<h2 id="circle-video-help-heading">${escapeHtml(CIRCLE_CALCULATOR_VIDEO_HELP_HEADING)}</h2>` +
    `<div class="circle-video-help__grid">${buttons}</div>` +
    `</section>`
  );
}

export function vimeoIdFromPlayerSrc(src: string): string | null {
  const match = src.match(/player\.vimeo\.com\/video\/(\d+)/);
  return match?.[1] ?? null;
}

export type CircleVideoHelpClickPlan = "open-modal" | "request-embed" | "stay-locked";

/** Member playback stays locked until access is confirmed. An armed button belongs to the site modal. */
export function planCircleVideoHelpClick(input: {
  armedWithVimeoId: boolean;
  hasMemberAccess: boolean;
  videoDevBypass?: boolean;
}): CircleVideoHelpClickPlan {
  if (input.armedWithVimeoId) return "open-modal";
  if (input.videoDevBypass || input.hasMemberAccess) return "request-embed";
  return "stay-locked";
}
