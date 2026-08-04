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
export const TIP_COPY_MAX = 2000;
export const TIP_ID_MAX = 80;
export const TIP_LEARN_POINT_MAX = 240;
export const TIP_LEARN_POINTS_MAX = 12;
export const TIP_RELATED_LINKS_MAX = 8;
export const TIP_RELATED_LABEL_MAX = 120;
export const TIP_RELATED_NOTE_MAX = 240;

export type TipRelatedLink = {
  label: string;
  href: string;
  note?: string;
};

/** Public / Watson tip record (camelCase DTO). */
export type TipOfTheWeekRecord = {
  id: string;
  tipId: string;
  title: string;
  intro: string;
  videoContentId: string;
  availableFrom: string;
  availableThrough: string;
  status: TipOfTheWeekStatus;
  availabilityNotice: string;
  availabilityFooterTemplate: string;
  tryCopy: string;
  sueTipCopy: string;
  learnPoints: string[];
  relatedLinks: TipRelatedLink[];
  eyebrow: string;
  createdAt: string;
  updatedAt: string;
};

export type TipOfTheWeekRow = {
  id: string;
  tip_id: string;
  title: string;
  intro: string;
  video_content_id: string;
  available_from: string | Date;
  available_through: string | Date;
  status: string;
  availability_notice: string;
  availability_footer_template: string;
  try_copy: string;
  sue_tip_copy: string;
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
