export const WHATS_NEW_CATEGORIES = [
  "tool",
  "pattern",
  "resource",
  "learning",
  "improvement",
] as const;

export type WhatsNewCategory = (typeof WHATS_NEW_CATEGORIES)[number];

export const WHATS_NEW_BOARD_COLUMNS = [
  "just_added",
  "worth_exploring",
  "in_the_pipeline",
] as const;

export type WhatsNewBoardColumn = (typeof WHATS_NEW_BOARD_COLUMNS)[number];

export const WHATS_NEW_STATUSES = ["draft", "published"] as const;

export type WhatsNewStatus = (typeof WHATS_NEW_STATUSES)[number];

export const WHATS_NEW_CATEGORY_LABELS: Record<WhatsNewCategory, string> = {
  tool: "Tool",
  pattern: "Pattern",
  resource: "Resource",
  learning: "Learning",
  improvement: "Improvement",
};

export const WHATS_NEW_DEFAULT_BUTTON_TEXT: Record<WhatsNewCategory, string> = {
  tool: "Try It",
  pattern: "View Pattern",
  resource: "Explore",
  learning: "Start Learning",
  improvement: "See What Changed",
};

export const WHATS_NEW_BOARD_COLUMN_META: Record<
  WhatsNewBoardColumn,
  { title: string; subtitle: string }
> = {
  just_added: {
    title: "Just Added",
    subtitle: "New tools, patterns, resources, and features",
  },
  // Stored slug stays worth_exploring so existing DB rows keep working.
  worth_exploring: {
    title: "Bugs & Improvements",
    subtitle: "Fixes and improvements to your Knit It Now experience",
  },
  in_the_pipeline: {
    title: "In the Pipeline",
    subtitle: "A peek at what's being developed",
  },
};

/** How many cards each public column shows before "Show more". */
export const WHATS_NEW_PUBLIC_COLUMN_INITIAL_LIMIT = 3;

export const WHATS_NEW_NEW_BADGE_DAYS = 30;
export const WHATS_NEW_FEATURED_VIDEO_SETTINGS_KEY = "featured_video";

export const WHATS_NEW_TITLE_MAX_LENGTH = 160;
export const WHATS_NEW_DESCRIPTION_MAX_LENGTH = 500;
export const WHATS_NEW_BUTTON_TEXT_MAX_LENGTH = 60;
export const WHATS_NEW_URL_MAX_LENGTH = 500;
export const WHATS_NEW_HEADLINE_MAX_LENGTH = 160;
/** Includes markup; rich-text messages need more room than plain text. */
export const WHATS_NEW_INTRODUCTION_MAX_LENGTH = 5000;

export type WhatsNewCardRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  destination_url: string | null;
  button_text: string | null;
  board_column: string;
  publish_date: Date | string;
  featured: boolean;
  status: string;
  display_order: number;
  archived: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type WhatsNewCard = {
  id: string;
  title: string;
  description: string;
  category: WhatsNewCategory;
  categoryLabel: string;
  destinationUrl: string | null;
  buttonText: string | null;
  boardColumn: WhatsNewBoardColumn;
  publishDate: string;
  featured: boolean;
  status: WhatsNewStatus;
  displayOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  isNew: boolean;
};

export type WhatsNewBillboardSettingsRow = {
  key: string;
  headline: string;
  introduction: string;
  original_video_url: string | null;
  safe_vimeo_embed_url: string | null;
  publish_date: Date | string | null;
  button_text?: string | null;
  button_destination_url?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  enabled: boolean;
  updated_at: Date | string;
};

export type WhatsNewBillboardSettings = {
  key: string;
  headline: string;
  message: string;
  originalVideoUrl: string | null;
  safeVimeoEmbedUrl: string | null;
  buttonText: string | null;
  buttonDestinationUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  publishDate: string | null;
  enabled: boolean;
  updatedAt: string;
};

/** @deprecated Use WhatsNewBillboardSettingsRow */
export type WhatsNewFeaturedVideoSettingsRow = WhatsNewBillboardSettingsRow;
/** @deprecated Use WhatsNewBillboardSettings */
export type WhatsNewFeaturedVideoSettings = WhatsNewBillboardSettings;

export type WhatsNewValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
