import { normalizeWhatsNewDestinationUrl } from "./destinationUrl";
import {
  defaultButtonTextForCategory,
  isWhatsNewBoardColumn,
  isWhatsNewCategory,
  isWhatsNewStatus,
  toIsoDateOnly,
} from "./public";
import {
  billboardMessageHasText,
  cardDescriptionPlainText,
  sanitizeBillboardHtml,
  sanitizeCardDescriptionHtml,
} from "./sanitizeBillboardHtml";
import {
  WHATS_NEW_BUTTON_TEXT_MAX_LENGTH,
  WHATS_NEW_DESCRIPTION_MAX_LENGTH,
  WHATS_NEW_HEADLINE_MAX_LENGTH,
  WHATS_NEW_INTRODUCTION_MAX_LENGTH,
  WHATS_NEW_TITLE_MAX_LENGTH,
  type WhatsNewBoardColumn,
  type WhatsNewCategory,
  type WhatsNewStatus,
  type WhatsNewValidationResult,
} from "./types";

export type ValidatedWhatsNewCardInput = {
  title: string;
  description: string;
  category: WhatsNewCategory;
  destinationUrl: string | null;
  buttonText: string | null;
  boardColumn: WhatsNewBoardColumn;
  publishDate: string;
  featured: boolean;
  status: WhatsNewStatus;
  displayOrder: number;
  archived: boolean;
};

export type ValidatedBillboardInput = {
  headline: string;
  introduction: string;
  originalVideoUrl: string | null;
  safeVimeoEmbedUrl: string | null;
  buttonText: string | null;
  buttonDestinationUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  publishDate: string | null;
  enabled: boolean;
};

/** @deprecated Use ValidatedBillboardInput */
export type ValidatedFeaturedVideoInput = ValidatedBillboardInput;

function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function requireTrimmedString(
  value: unknown,
  label: string,
  maxLength: number,
): WhatsNewValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is required.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${label} is required.` };
  }
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

function optionalTrimmedString(
  value: unknown,
  label: string,
  maxLength: number,
): WhatsNewValidationResult<string> {
  if (value == null || value === "") {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${label} must be a string.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validatePublishDate(
  value: unknown,
  fallbackToday: boolean = true,
  now: Date = new Date(),
): WhatsNewValidationResult<string> {
  if (value == null || value === "") {
    if (fallbackToday) {
      return { ok: true, value: todayIsoDate(now) };
    }
    return { ok: false, error: "Publish date is required." };
  }
  if (typeof value !== "string" && !(value instanceof Date)) {
    return { ok: false, error: "Publish date is invalid." };
  }
  const iso = toIsoDateOnly(value as Date | string);
  if (!iso) {
    return { ok: false, error: "Publish date is invalid." };
  }
  return { ok: true, value: iso };
}

export function validateWhatsNewCardInput(
  input: Record<string, unknown>,
  now: Date = new Date(),
): WhatsNewValidationResult<ValidatedWhatsNewCardInput> {
  const title = requireTrimmedString(input.title, "Title", WHATS_NEW_TITLE_MAX_LENGTH);
  if (!title.ok) return title;

  if (input.description != null && typeof input.description !== "string") {
    return { ok: false, error: "Short description is required." };
  }
  const descriptionRaw = typeof input.description === "string" ? input.description.trim() : "";
  // Length gate uses the visible text so markup overhead never rejects short copy.
  const descriptionText = cardDescriptionPlainText(descriptionRaw);
  if (!descriptionText) {
    return { ok: false, error: "Short description is required." };
  }
  if (descriptionText.length > WHATS_NEW_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Short description must be ${WHATS_NEW_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    };
  }
  // Sanitize server-side before saving; plain text becomes safe paragraph markup.
  const descriptionHtml = sanitizeCardDescriptionHtml(descriptionRaw);
  if (!billboardMessageHasText(descriptionHtml)) {
    return { ok: false, error: "Short description is required." };
  }

  if (typeof input.category !== "string" || !isWhatsNewCategory(input.category.trim())) {
    return {
      ok: false,
      error: `Category must be one of: ${["tool", "pattern", "resource", "learning", "improvement"].join(", ")}.`,
    };
  }
  const category = input.category.trim() as WhatsNewCategory;

  const destination = normalizeWhatsNewDestinationUrl(input.destinationUrl ?? input.destination_url);
  if (!destination.ok) return destination;

  const buttonRaw = optionalTrimmedString(
    input.buttonText ?? input.button_text,
    "Button text",
    WHATS_NEW_BUTTON_TEXT_MAX_LENGTH,
  );
  if (!buttonRaw.ok) return buttonRaw;

  let buttonText: string | null = buttonRaw.value || null;
  if (!buttonText && destination.value) {
    buttonText = defaultButtonTextForCategory(category);
  }
  if (!destination.value) {
    buttonText = buttonRaw.value || null;
  }

  if (
    typeof input.boardColumn !== "string" &&
    typeof input.board_column !== "string"
  ) {
    return { ok: false, error: "Board column is required." };
  }
  const boardColumnRaw = String(input.boardColumn ?? input.board_column).trim();
  if (!isWhatsNewBoardColumn(boardColumnRaw)) {
    return {
      ok: false,
      error:
        "Board column must be one of: just_added, worth_exploring, in_the_pipeline.",
    };
  }

  const publishDate = validatePublishDate(
    input.publishDate ?? input.publish_date,
    true,
    now,
  );
  if (!publishDate.ok) return publishDate;

  const statusRaw = String(input.status ?? "draft").trim();
  if (!isWhatsNewStatus(statusRaw)) {
    return { ok: false, error: "Status must be draft or published." };
  }

  const displayOrderRaw = input.displayOrder ?? input.display_order ?? 0;
  const displayOrder =
    typeof displayOrderRaw === "number"
      ? displayOrderRaw
      : Number.parseInt(String(displayOrderRaw), 10);
  if (!Number.isFinite(displayOrder) || !Number.isInteger(displayOrder)) {
    return { ok: false, error: "Display order must be an integer." };
  }

  return {
    ok: true,
    value: {
      title: title.value,
      description: descriptionHtml,
      category,
      destinationUrl: destination.value,
      buttonText,
      boardColumn: boardColumnRaw,
      publishDate: publishDate.value,
      featured: Boolean(input.featured),
      status: statusRaw,
      displayOrder,
      archived: Boolean(input.archived),
    },
  };
}

export function validateBillboardInput(
  input: Record<string, unknown>,
  normalizeVimeo: (raw: unknown) => {
    originalVimeoUrl: string;
    safeVimeoEmbedUrl: string;
  } | null,
): WhatsNewValidationResult<ValidatedBillboardInput> {
  const enabled = Boolean(input.enabled);

  const headlineRaw = optionalTrimmedString(
    input.headline,
    "Headline",
    WHATS_NEW_HEADLINE_MAX_LENGTH,
  );
  if (!headlineRaw.ok) return headlineRaw;

  const messageInput = input.message ?? input.introduction;
  if (messageInput != null && typeof messageInput !== "string") {
    return { ok: false, error: "Short message must be a string." };
  }
  const messageTrimmed = typeof messageInput === "string" ? messageInput.trim() : "";
  if (messageTrimmed.length > WHATS_NEW_INTRODUCTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Short message must be ${WHATS_NEW_INTRODUCTION_MAX_LENGTH} characters or fewer.`,
    };
  }
  const messageSanitized = messageTrimmed ? sanitizeBillboardHtml(messageTrimmed) : "";
  if (messageSanitized.length > WHATS_NEW_INTRODUCTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Short message must be ${WHATS_NEW_INTRODUCTION_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (enabled) {
    if (!headlineRaw.value) {
      return { ok: false, error: "Headline is required when the billboard is enabled." };
    }
    if (!billboardMessageHasText(messageSanitized)) {
      return { ok: false, error: "Short message is required when the billboard is enabled." };
    }
  }

  const videoUrlRaw = input.videoUrl ?? input.originalVideoUrl ?? input.original_video_url;
  const hasVideoUrl =
    typeof videoUrlRaw === "string" ? videoUrlRaw.trim().length > 0 : Boolean(videoUrlRaw);

  let originalVideoUrl: string | null = null;
  let safeVimeoEmbedUrl: string | null = null;

  if (hasVideoUrl) {
    if (typeof videoUrlRaw === "string" && /<iframe/i.test(videoUrlRaw)) {
      return { ok: false, error: "Paste a Vimeo URL, not embed HTML." };
    }
    const normalized = normalizeVimeo(videoUrlRaw);
    if (!normalized) {
      return {
        ok: false,
        error: "Video URL must be a valid Vimeo link.",
      };
    }
    originalVideoUrl = normalized.originalVimeoUrl;
    safeVimeoEmbedUrl = normalized.safeVimeoEmbedUrl;
  }

  const buttonTextRaw = optionalTrimmedString(
    input.buttonText ?? input.button_text,
    "Button text",
    WHATS_NEW_BUTTON_TEXT_MAX_LENGTH,
  );
  if (!buttonTextRaw.ok) return buttonTextRaw;

  const destination = normalizeWhatsNewDestinationUrl(
    input.buttonDestinationUrl ??
      input.button_destination_url ??
      input.destinationUrl ??
      input.destination_url,
  );
  if (!destination.ok) return destination;

  const buttonText = buttonTextRaw.value || null;
  const buttonDestinationUrl = destination.value;
  if ((buttonText && !buttonDestinationUrl) || (!buttonText && buttonDestinationUrl)) {
    return {
      ok: false,
      error: "Button text and destination URL must be provided together.",
    };
  }

  let startDate: string | null = null;
  const startRaw = input.startDate ?? input.start_date;
  if (startRaw != null && startRaw !== "") {
    const validated = validatePublishDate(startRaw, false);
    if (!validated.ok) return { ok: false, error: "Start date is invalid." };
    startDate = validated.value;
  }

  let endDate: string | null = null;
  const endRaw = input.endDate ?? input.end_date;
  if (endRaw != null && endRaw !== "") {
    const validated = validatePublishDate(endRaw, false);
    if (!validated.ok) return { ok: false, error: "End date is invalid." };
    endDate = validated.value;
  }

  if (startDate && endDate && endDate < startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  let publishDate: string | null = null;
  const publishDateRaw = input.publishDate ?? input.publish_date;
  if (publishDateRaw != null && publishDateRaw !== "") {
    const validated = validatePublishDate(publishDateRaw, false);
    if (!validated.ok) return validated;
    publishDate = validated.value;
  }

  return {
    ok: true,
    value: {
      headline: headlineRaw.value,
      introduction: messageSanitized,
      originalVideoUrl,
      safeVimeoEmbedUrl,
      buttonText,
      buttonDestinationUrl,
      startDate,
      endDate,
      publishDate,
      enabled,
    },
  };
}

/** @deprecated Use validateBillboardInput */
export const validateFeaturedVideoInput = validateBillboardInput;
