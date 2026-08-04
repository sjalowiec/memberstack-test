/**
 * Tip of the Week input validation (Watson create/update).
 */
import { normalizeWhatsNewDestinationUrl } from "../whatsNew/destinationUrl";
import { isIsoDateOnly, tipDateRangesOverlap } from "./schedule";
import {
  TIP_COPY_MAX,
  TIP_DEFAULT_AVAILABILITY_NOTICE,
  TIP_DEFAULT_EYEBROW,
  TIP_DEFAULT_FOOTER_TEMPLATE,
  TIP_ID_MAX,
  TIP_INTRO_MAX,
  TIP_LEARN_POINT_MAX,
  TIP_LEARN_POINTS_MAX,
  TIP_RELATED_LABEL_MAX,
  TIP_RELATED_LINKS_MAX,
  TIP_RELATED_NOTE_MAX,
  TIP_TITLE_MAX,
  isTipOfTheWeekStatus,
  type TipOfTheWeekRecord,
  type TipOfTheWeekStatus,
  type TipRelatedLink,
  type TipValidationResult,
} from "./types";

export type ValidatedTipInput = {
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
};

function requireTrimmed(
  value: unknown,
  label: string,
  max: number,
): TipValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is required.` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `${label} is required.` };
  if (trimmed.length > max) {
    return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

function optionalTrimmed(
  value: unknown,
  label: string,
  max: number,
  fallback: string,
): TipValidationResult<string> {
  if (value == null || value === "") {
    return { ok: true, value: fallback };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${label} must be a string.` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: fallback };
  if (trimmed.length > max) {
    return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

function parseLearnPoints(raw: unknown): TipValidationResult<string[]> {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Learning points must be a list." };
      }
      list = parsed;
    } catch {
      return { ok: false, error: "Learning points must be valid JSON." };
    }
  } else if (raw == null) {
    list = [];
  } else {
    return { ok: false, error: "Learning points must be a list." };
  }

  if (list.length > TIP_LEARN_POINTS_MAX) {
    return {
      ok: false,
      error: `At most ${TIP_LEARN_POINTS_MAX} learning points are allowed.`,
    };
  }

  const points: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      return { ok: false, error: "Each learning point must be text." };
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > TIP_LEARN_POINT_MAX) {
      return {
        ok: false,
        error: `Learning points must be ${TIP_LEARN_POINT_MAX} characters or fewer.`,
      };
    }
    points.push(trimmed);
  }
  return { ok: true, value: points };
}

function parseRelatedLinks(raw: unknown): TipValidationResult<TipRelatedLink[]> {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Related links must be a list." };
      }
      list = parsed;
    } catch {
      return { ok: false, error: "Related links must be valid JSON." };
    }
  } else if (raw == null) {
    list = [];
  } else {
    return { ok: false, error: "Related links must be a list." };
  }

  if (list.length > TIP_RELATED_LINKS_MAX) {
    return {
      ok: false,
      error: `At most ${TIP_RELATED_LINKS_MAX} related links are allowed.`,
    };
  }

  const links: TipRelatedLink[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Each related link must be an object." };
    }
    const row = item as Record<string, unknown>;
    const labelResult = requireTrimmed(
      row.label ?? row.title,
      "Related link title",
      TIP_RELATED_LABEL_MAX,
    );
    if (!labelResult.ok) return labelResult;

    const hrefRaw = row.href ?? row.url ?? row.destinationUrl;
    const hrefResult = normalizeWhatsNewDestinationUrl(hrefRaw);
    if (!hrefResult.ok) return hrefResult;
    if (!hrefResult.value || !hrefResult.value.startsWith("/")) {
      return {
        ok: false,
        error: "Related links must use an internal site path (starting with /).",
      };
    }

    let note: string | undefined;
    const noteRaw = row.note ?? row.description;
    if (typeof noteRaw === "string" && noteRaw.trim()) {
      const trimmed = noteRaw.trim();
      if (trimmed.length > TIP_RELATED_NOTE_MAX) {
        return {
          ok: false,
          error: `Related link notes must be ${TIP_RELATED_NOTE_MAX} characters or fewer.`,
        };
      }
      note = trimmed;
    }

    links.push({ label: labelResult.value, href: hrefResult.value, note });
  }
  return { ok: true, value: links };
}

function parseTipId(raw: unknown): TipValidationResult<string> {
  const result = requireTrimmed(raw, "Tip ID", TIP_ID_MAX);
  if (!result.ok) return result;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(result.value)) {
    return {
      ok: false,
      error: "Tip ID must be a slug (letters, numbers, hyphens).",
    };
  }
  return { ok: true, value: result.value.toLowerCase() };
}

function parseVideoContentId(raw: unknown): TipValidationResult<string> {
  const asString =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(Math.trunc(raw))
      : typeof raw === "string"
        ? raw.trim()
        : "";
  if (!asString) {
    return { ok: false, error: "Learning Library content ID is required." };
  }
  if (!/^\d{1,12}$/.test(asString)) {
    return {
      ok: false,
      error: "Learning Library content ID must be a numeric catalog id.",
    };
  }
  return { ok: true, value: asString };
}

function parseDateField(
  raw: unknown,
  label: string,
): TipValidationResult<string> {
  if (typeof raw !== "string" || !isIsoDateOnly(raw.trim())) {
    return { ok: false, error: `${label} must be a date (YYYY-MM-DD).` };
  }
  return { ok: true, value: raw.trim() };
}

/**
 * Validate create/update payload. Overlap checks against `siblings` (other tips).
 */
export function validateTipOfTheWeekInput(
  input: Record<string, unknown>,
  options?: {
    siblings?: Array<
      Pick<TipOfTheWeekRecord, "id" | "status" | "availableFrom" | "availableThrough">
    >;
    existingId?: string;
    allowOverlapWarningOnly?: boolean;
  },
): TipValidationResult<ValidatedTipInput> & { warning?: string } {
  const tipId = parseTipId(input.tipId ?? input.tip_id);
  if (!tipId.ok) return tipId;

  const title = requireTrimmed(input.title, "Title", TIP_TITLE_MAX);
  if (!title.ok) return title;

  const intro = requireTrimmed(input.intro, "Introduction", TIP_INTRO_MAX);
  if (!intro.ok) return intro;

  const videoContentId = parseVideoContentId(
    input.videoContentId ?? input.video_content_id,
  );
  if (!videoContentId.ok) return videoContentId;

  const availableFrom = parseDateField(
    input.availableFrom ?? input.available_from,
    "Available from",
  );
  if (!availableFrom.ok) return availableFrom;

  const availableThrough = parseDateField(
    input.availableThrough ?? input.available_through,
    "Available through",
  );
  if (!availableThrough.ok) return availableThrough;

  if (availableFrom.value > availableThrough.value) {
    return {
      ok: false,
      error: "Available from must be on or before available through.",
    };
  }

  const statusRaw = input.status ?? "draft";
  if (!isTipOfTheWeekStatus(statusRaw)) {
    return { ok: false, error: "Status is invalid." };
  }
  const status = statusRaw;

  const availabilityNotice = optionalTrimmed(
    input.availabilityNotice ?? input.availability_notice,
    "Availability notice",
    120,
    TIP_DEFAULT_AVAILABILITY_NOTICE,
  );
  if (!availabilityNotice.ok) return availabilityNotice;

  const availabilityFooterTemplate = optionalTrimmed(
    input.availabilityFooterTemplate ?? input.availability_footer_template,
    "Availability footer",
    TIP_COPY_MAX,
    TIP_DEFAULT_FOOTER_TEMPLATE,
  );
  if (!availabilityFooterTemplate.ok) return availabilityFooterTemplate;
  if (!availabilityFooterTemplate.value.includes("{date}")) {
    return {
      ok: false,
      error: 'Availability footer must include the "{date}" placeholder.',
    };
  }

  const tryCopy = optionalTrimmed(
    input.tryCopy ?? input.try_copy,
    "Try It text",
    TIP_COPY_MAX,
    "",
  );
  if (!tryCopy.ok) return tryCopy;

  const sueTipCopy = optionalTrimmed(
    input.sueTipCopy ?? input.sue_tip_copy,
    "Sue’s Tip text",
    TIP_COPY_MAX,
    "",
  );
  if (!sueTipCopy.ok) return sueTipCopy;

  const eyebrow = optionalTrimmed(
    input.eyebrow,
    "Eyebrow",
    80,
    TIP_DEFAULT_EYEBROW,
  );
  if (!eyebrow.ok) return eyebrow;

  const learnPoints = parseLearnPoints(
    input.learnPoints ?? input.learn_points ?? input.learn_points_json,
  );
  if (!learnPoints.ok) return learnPoints;

  const relatedLinks = parseRelatedLinks(
    input.relatedLinks ?? input.related_links ?? input.related_links_json,
  );
  if (!relatedLinks.ok) return relatedLinks;

  let warning: string | undefined;
  if (status === "scheduled" || status === "active") {
    const siblings = options?.siblings ?? [];
    for (const sibling of siblings) {
      if (options?.existingId && sibling.id === options.existingId) continue;
      if (sibling.status !== "scheduled" && sibling.status !== "active") continue;
      if (
        tipDateRangesOverlap(
          availableFrom.value,
          availableThrough.value,
          sibling.availableFrom,
          sibling.availableThrough,
        )
      ) {
        const message =
          "This date range overlaps another scheduled or active Tip of the Week.";
        if (options?.allowOverlapWarningOnly) {
          warning = message;
        } else {
          return { ok: false, error: message };
        }
      }
    }
  }

  const value: ValidatedTipInput = {
    tipId: tipId.value,
    title: title.value,
    intro: intro.value,
    videoContentId: videoContentId.value,
    availableFrom: availableFrom.value,
    availableThrough: availableThrough.value,
    status,
    availabilityNotice: availabilityNotice.value,
    availabilityFooterTemplate: availabilityFooterTemplate.value,
    tryCopy: tryCopy.value,
    sueTipCopy: sueTipCopy.value,
    learnPoints: learnPoints.value,
    relatedLinks: relatedLinks.value,
    eyebrow: eyebrow.value,
  };

  return warning ? { ok: true, value, warning } : { ok: true, value };
}
