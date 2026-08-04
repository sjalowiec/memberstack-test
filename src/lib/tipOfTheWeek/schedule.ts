/**
 * Tip of the Week scheduling helpers (America/Los_Angeles calendar days).
 */
import {
  TIP_OF_THE_WEEK_TIME_ZONE,
  type TipOfTheWeekRecord,
  type TipOfTheWeekStatus,
} from "./types";

/** Calendar date YYYY-MM-DD in America/Los_Angeles. */
export function tipLosAngelesCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIP_OF_THE_WEEK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isIsoDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Inclusive tip window length in calendar days (start through end). */
export const TIP_DEFAULT_WINDOW_DAYS = 7;

/** Days to add to Available From to get the default Available Through. */
export const TIP_DEFAULT_WINDOW_OFFSET_DAYS = TIP_DEFAULT_WINDOW_DAYS - 1;

/**
 * Add calendar days to a YYYY-MM-DD date using UTC date components only.
 * Avoids local/UTC conversion shifting the calendar day.
 */
export function addCalendarDays(isoDate: string, days: number): string | null {
  if (!isIsoDateOnly(isoDate) || !Number.isFinite(days)) return null;
  const [year, month, day] = isoDate.trim().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Default Available Through for a 7-day inclusive window (start + 6 days). */
export function defaultTipAvailableThrough(availableFrom: string): string | null {
  return addCalendarDays(availableFrom, TIP_DEFAULT_WINDOW_OFFSET_DAYS);
}

export type TipDateFormState = {
  availableFrom: string;
  availableThrough: string;
  /** When true, changing Available From must not overwrite Available Through. */
  throughManuallyEdited: boolean;
};

/** New tip: auto end-date. Existing tip: preserve stored end date until Reset. */
export function initTipDateFormState(input?: {
  availableFrom?: string;
  availableThrough?: string;
  isExisting?: boolean;
} | null): TipDateFormState {
  const availableFrom =
    typeof input?.availableFrom === "string" ? input.availableFrom.trim() : "";
  const availableThrough =
    typeof input?.availableThrough === "string" ? input.availableThrough.trim() : "";
  const isExisting = Boolean(input?.isExisting);
  return {
    availableFrom,
    availableThrough,
    throughManuallyEdited: isExisting,
  };
}

export function onTipAvailableFromChanged(
  state: TipDateFormState,
  nextFrom: string,
): TipDateFormState {
  const availableFrom = String(nextFrom || "").trim();
  if (state.throughManuallyEdited) {
    return { ...state, availableFrom };
  }
  const autoThrough = defaultTipAvailableThrough(availableFrom);
  return {
    ...state,
    availableFrom,
    availableThrough: autoThrough || state.availableThrough,
  };
}

export function onTipAvailableThroughChanged(
  state: TipDateFormState,
  nextThrough: string,
): TipDateFormState {
  return {
    ...state,
    availableThrough: String(nextThrough || "").trim(),
    throughManuallyEdited: true,
  };
}

export function resetTipAvailableThroughToSevenDays(
  state: TipDateFormState,
): TipDateFormState {
  const autoThrough = defaultTipAvailableThrough(state.availableFrom);
  return {
    ...state,
    availableThrough: autoThrough || state.availableThrough,
    throughManuallyEdited: false,
  };
}

/** Inclusive overlap of two [from, through] calendar ranges. */
export function tipDateRangesOverlap(
  aFrom: string,
  aThrough: string,
  bFrom: string,
  bThrough: string,
): boolean {
  return aFrom <= bThrough && bFrom <= aThrough;
}

/**
 * Whether a tip is the publicly featured free lesson on `today` (LA).
 * Draft/archived never; scheduled/active only inside their date window.
 */
export function tipIsPubliclyFeatured(
  tip: Pick<TipOfTheWeekRecord, "status" | "availableFrom" | "availableThrough">,
  todayLa: string = tipLosAngelesCalendarDate(),
): boolean {
  if (tip.status === "draft" || tip.status === "archived") return false;
  if (tip.status !== "scheduled" && tip.status !== "active") return false;
  if (!isIsoDateOnly(tip.availableFrom) || !isIsoDateOnly(tip.availableThrough)) {
    return false;
  }
  return tip.availableFrom <= todayLa && tip.availableThrough >= todayLa;
}

/** True when the free public playback window has ended (or tip never public). */
export function tipFreeWindowExpired(
  tip: Pick<TipOfTheWeekRecord, "availableThrough">,
  todayLa: string = tipLosAngelesCalendarDate(),
): boolean {
  if (!isIsoDateOnly(tip.availableThrough)) return true;
  return tip.availableThrough < todayLa;
}

export function tipFreeWindowNotStarted(
  tip: Pick<TipOfTheWeekRecord, "availableFrom">,
  todayLa: string = tipLosAngelesCalendarDate(),
): boolean {
  if (!isIsoDateOnly(tip.availableFrom)) return true;
  return tip.availableFrom > todayLa;
}

export type TipScheduleBucket = "current" | "scheduled" | "draft" | "archived" | "expired";

/** Bucket a tip for Watson list UI (not the public picker). */
export function tipScheduleBucket(
  tip: Pick<TipOfTheWeekRecord, "status" | "availableFrom" | "availableThrough">,
  todayLa: string = tipLosAngelesCalendarDate(),
): TipScheduleBucket {
  if (tip.status === "draft") return "draft";
  if (tip.status === "archived") return "archived";
  if (tipIsPubliclyFeatured(tip, todayLa)) return "current";
  if (
    (tip.status === "scheduled" || tip.status === "active") &&
    tipFreeWindowExpired(tip, todayLa)
  ) {
    return "expired";
  }
  if (
    (tip.status === "scheduled" || tip.status === "active") &&
    tipFreeWindowNotStarted(tip, todayLa)
  ) {
    return "scheduled";
  }
  return "expired";
}

export function statusLabel(status: TipOfTheWeekStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "active":
      return "Active";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}
