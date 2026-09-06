/**
 * Tip of the Week — shared types (Watson Postgres + public page).
 */

export const TIP_OF_THE_WEEK_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "archived",
] as const;

export type TipOfTheWeekStatus = (typeof TIP_OF_THE_WEEK_STATUSES)[number];

export const TIP_OF_THE_WEEK_TIME_ZONE = "America/Los_Angeles";

export const TIP_DEFAULT_EYEBROW = "TIP OF THE WEEK";
export const TIP_DEFAULT_AVAILABILITY_NOTICE = "Free to watch this week";
export const TIP_DEFAULT_FOOTER_TEMPLATE =
  "This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.";

export const TIP_TITLE_MAX = 160;
export const TIP_INTRO_MAX = 1200;
export const TIP_INTRO_GLOSSARY_SLUG_MAX = 80;
export const TIP_COPY_MAX = 2000;
export const TIP_ID_MAX = 80;
export const TIP_LEARN_POINT_MAX = 240;
export const TIP_LEARN_POINTS_MAX = 12;
export const TIP_RELATED_LINKS_MAX = 8;
export const TIP_RELATED_LABEL_MAX = 120;
export const TIP_RELATED_NOTE_MAX = 240;
export const TIP_CTA_TEXT_MAX = 80;

export const TIP_RELATED_RESOURCE_TYPES = ["video", "link"] as const;
export type TipRelatedResourceType = (typeof TIP_RELATED_RESOURCE_TYPES)[number];

/** Knit It Now Learning Library video — `videoId` is catalog content_id. */
export type TipRelatedVideoResource = {
  type: "video";
  videoId: string;
  /** Catalog title resolved at save (display cache). */
  title: string;
  note?: string;
};

/** Manual link or document (internal path, PDF/download, or https URL). */
export type TipRelatedLinkResource = {
  type: "link";
  title: string;
  url: string;
  note?: string;
};

export type TipRelatedResource = TipRelatedVideoResource | TipRelatedLinkResource;

/** Public Related Help row after filtering / live video title resolve. */
export type TipRelatedPublicLink = {
  type: TipRelatedResourceType;
  label: string;
  href: string;
  note?: string;
  external: boolean;
};

/**
 * @deprecated Prefer TipRelatedResource. Kept as an alias for older call sites
 * that still mean “a related help entry.”
 */
export type TipRelatedLink = TipRelatedResource;

/** Public / Watson tip record (camelCase DTO). */
export type TipOfTheWeekRecord = {
  id: string;
  tipId: string;
  title: string;
  intro: string;
  /** Optional glossary slug or phrase; first intro match becomes a tooltip. */
  introGlossarySlug: string;
  videoContentId: string;
  availableFrom: string;
  availableThrough: string;
  status: TipOfTheWeekStatus;
  availabilityNotice: string;
  availabilityFooterTemplate: string;
  tryCopy: string;
  sueTipCopy: string;
  ctaText: string;
  ctaUrl: string;
  learnPoints: string[];
  relatedLinks: TipRelatedResource[];
  eyebrow: string;
  createdAt: string;
  updatedAt: string;
};

export type TipOfTheWeekRow = {
  id: string;
  tip_id: string;
  title: string;
  intro: string;
  intro_glossary_slug?: string | null;
  video_content_id: string;
  available_from: string | Date;
  available_through: string | Date;
  status: string;
  availability_notice: string;
  availability_footer_template: string;
  try_copy: string;
  sue_tip_copy: string;
  cta_text?: string | null;
  cta_url?: string | null;
  learn_points_json: string;
  related_links_json: string;
  eyebrow: string;
  created_at: string | Date;
  updated_at: string | Date;
};

export type TipValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isTipOfTheWeekStatus(value: unknown): value is TipOfTheWeekStatus {
  return (
    typeof value === "string" &&
    (TIP_OF_THE_WEEK_STATUSES as readonly string[]).includes(value)
  );
}
