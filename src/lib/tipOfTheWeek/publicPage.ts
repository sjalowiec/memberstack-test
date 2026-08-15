/**
 * Public Tip of the Week loader.
 *
 * Production always uses Watson Postgres (`getPublicFeaturedTip`).
 * JSON (`src/data/tip-of-the-week.json`) is used ONLY when
 * `TIP_OF_THE_WEEK_DEV_JSON=true` (local UI work without a Watson DB).
 * Never silently fall back to JSON when Watson is unavailable.
 */
import tipJson from "../../data/tip-of-the-week.json";
import type { TipOfTheWeekConfig } from "../tipOfTheWeek";
import {
  filterPublicRelatedLinks,
  formatTipAvailabilityDate,
  normalizeRelatedResources,
  tipAvailabilityFooterFromRecord,
} from "./map";
import { tipIsPubliclyFeatured, tipLosAngelesCalendarDate } from "./schedule";
import { getPublicFeaturedTip, getTipOfTheWeekById } from "./store";
import type { TipOfTheWeekRecord, TipRelatedPublicLink } from "./types";

export type PublicTipPageModel = {
  source: "watson" | "dev-json" | "watson-preview";
  tip: TipOfTheWeekRecord;
  availableThroughDisplay: string;
  availabilityFooter: string;
  relatedLinks: TipRelatedPublicLink[];
  isPlayable: true;
  isPreview?: boolean;
};

export type PublicTipPageState =
  | { kind: "featured"; model: PublicTipPageModel }
  | { kind: "coming_soon"; reason: "none" | "watson_unavailable" };

function tipConfigToRecord(config: TipOfTheWeekConfig): TipOfTheWeekRecord {
  return {
    id: `dev-json:${config.tipId}`,
    tipId: config.tipId,
    title: config.title,
    intro: config.intro,
    introGlossarySlug: String(config.introGlossarySlug || "").trim(),
    videoContentId: String(config.videoContentId),
    availableFrom:
      typeof config.availableFrom === "string" && config.availableFrom
        ? config.availableFrom
        : tipLosAngelesCalendarDate(),
    availableThrough: config.availableThrough,
    status: "active",
    availabilityNotice: config.availabilityNotice,
    availabilityFooterTemplate: config.availabilityFooterTemplate,
    tryCopy: config.tryCopy,
    sueTipCopy: config.sueTipCopy,
    learnPoints: [...config.learnPoints],
    relatedLinks: normalizeRelatedResources(config.relatedLinks),
    eyebrow: config.eyebrow,
    createdAt: "",
    updatedAt: "",
  };
}

function useDevJsonFallback(): boolean {
  const fromImportMeta =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env
          ?.TIP_OF_THE_WEEK_DEV_JSON
      : undefined;
  const raw = fromImportMeta || process.env.TIP_OF_THE_WEEK_DEV_JSON || "";
  return String(raw).trim() === "true";
}

function featuredModelFromRecord(
  tip: TipOfTheWeekRecord,
  source: PublicTipPageModel["source"],
  isPreview = false,
): PublicTipPageModel {
  return {
    source,
    tip,
    availableThroughDisplay: formatTipAvailabilityDate(tip.availableThrough),
    availabilityFooter: tipAvailabilityFooterFromRecord(tip),
    relatedLinks: filterPublicRelatedLinks(tip.relatedLinks),
    isPlayable: true,
    isPreview,
  };
}

/**
 * Watson-admin preview: load any tip by id without changing public scheduling.
 * Callers must verify Watson session before invoking.
 */
export async function loadTipOfTheWeekPreview(
  tipRecordId: string,
): Promise<PublicTipPageState> {
  const id = String(tipRecordId || "").trim();
  if (!id) return { kind: "coming_soon", reason: "none" };
  try {
    const tip = await getTipOfTheWeekById(id);
    if (!tip) return { kind: "coming_soon", reason: "none" };
    return {
      kind: "featured",
      model: featuredModelFromRecord(tip, "watson-preview", true),
    };
  } catch {
    return { kind: "coming_soon", reason: "watson_unavailable" };
  }
}

/**
 * Resolve what the public `/tip-of-the-week` page should render.
 */
export async function loadPublicTipOfTheWeekPage(
  now: Date = new Date(),
): Promise<PublicTipPageState> {
  if (useDevJsonFallback()) {
    const record = tipConfigToRecord(tipJson as TipOfTheWeekConfig);
    const today = tipLosAngelesCalendarDate(now);
    if (!tipIsPubliclyFeatured(record, today)) {
      return { kind: "coming_soon", reason: "none" };
    }
    return {
      kind: "featured",
      model: featuredModelFromRecord(record, "dev-json"),
    };
  }

  try {
    const tip = await getPublicFeaturedTip(undefined, now);
    if (!tip) {
      return { kind: "coming_soon", reason: "none" };
    }
    return {
      kind: "featured",
      model: featuredModelFromRecord(tip, "watson"),
    };
  } catch {
    return { kind: "coming_soon", reason: "watson_unavailable" };
  }
}

export { formatTipAvailabilityDate, tipAvailabilityFooterFromRecord };
