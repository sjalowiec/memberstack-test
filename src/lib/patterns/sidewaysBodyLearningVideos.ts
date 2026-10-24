/**
 * Learning Library videos for Sideways sweater body instructions.
 * Content ids are Knit it Now catalog ids. Vimeo ids come from the catalog row.
 * A missing row produces no control, so a different video is never substituted.
 *
 * Controls are compact pattern-help buttons. They open KinCatalogVideoModal,
 * which plays `data-vimeo-id` directly. Pattern access is enough to watch.
 * These buttons do not link to `/videos/{id}` and do not use the Learning
 * Library player (`catalog-video-embed` / GatedVimeoEmbed). The catalog rows
 * stay member-gated on the library pages.
 *
 * `data-vimeo-defer` is required. The Vimeo player script, loaded when the
 * modal opens, otherwise turns every `data-vimeo-id` element into an inline
 * player. The button must stay a button until it is clicked.
 */
import {
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "./sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../lessonVideo";
import videosPublic from "../../data/videos-public.json";

/** “Shaping a Sideways V-Neck”. Pullover V-neck only. */
export const SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID = 5003;

/** “Sideways Bust Darts”. Optional for pullover and cardigan. */
export const SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID = 1012;

/** “Sideways Sweater Waist Shaping”. Optional for pullover and cardigan. */
export const SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID = 960;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveSidewaysLearningVideo(
  contentId: number,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(contentId, catalog);
}

/**
 * Blank neckline stays V-neck: the Sideways pullover builder authors `neckline: "v"`.
 * Any other saved neckline is not this video.
 */
export function isSidewaysVNeckline(neckline: unknown): boolean {
  const raw = String(neckline ?? "").trim().toLowerCase();
  const neck = raw || "v";
  return neck === "v" || neck === "v-neck" || neck === "vneck";
}

/**
 * Compact button only. No iframe, poster, or library link is rendered until
 * KinCatalogVideoModal opens on click.
 */
function catalogVideoButtonHtml(args: {
  contentId: number;
  hook: string;
  catalog?: PublicVideoRow[];
}): string {
  const video = resolveSidewaysLearningVideo(args.contentId, args.catalog);
  if (!video) return "";
  return (
    `<span class="pattern-help-link">` +
    `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${args.contentId}"` +
    ` data-video-autoplay="false"` +
    ` data-vimeo-defer` +
    ` ${args.hook}` +
    ` aria-haspopup="dialog">` +
    `<i class="fa-solid fa-play" aria-hidden="true"></i> ` +
    `${escapeHtml(`Watch: ${video.title}`)}</button></span>`
  );
}

/**
 * Help lines for each pullover V-neck shaping section.
 * Empty for any other neckline, and empty when content_id 5003 cannot be resolved.
 * The button is its own block so the instruction text never contains a player.
 */
export function sidewaysPulloverVNeckShapingLines(
  neckline: unknown = "v",
  catalog?: PublicVideoRow[],
): string[] {
  if (!isSidewaysVNeckline(neckline)) return [];
  const button = catalogVideoButtonHtml({
    contentId: SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID,
    hook: "data-sideways-v-neck-shaping-video",
    catalog,
  });
  if (!button) return [];
  return [
    "This video shows the sideways V-neck shaping used in these instructions.",
    button,
  ];
}

function optionalTechniqueLines(args: {
  contentId: number;
  hook: string;
  technique: string;
  catalog?: PublicVideoRow[];
}): string[] {
  const button = catalogVideoButtonHtml({
    contentId: args.contentId,
    hook: args.hook,
    catalog: args.catalog,
  });
  if (!button) return [];
  return [
    `Optional technique: ${args.technique}. This video shows shaping you can choose to add. ` +
      `The pattern instructions do not include this shaping.`,
    button,
  ];
}

/** Optional bust-dart and waist-shaping lines. Either pair is omitted when its catalog row is missing. */
export function sidewaysOptionalShapingParagraphs(
  catalog?: PublicVideoRow[],
): string[] {
  return [
    ...optionalTechniqueLines({
      contentId: SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID,
      hook: "data-sideways-bust-darts-video",
      technique: "Sideways bust darts",
      catalog,
    }),
    ...optionalTechniqueLines({
      contentId: SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID,
      hook: "data-sideways-waist-shaping-video",
      technique: "Sideways waist shaping",
      catalog,
    }),
  ];
}
