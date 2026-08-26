/**
 * America/Los_Angeles calendar-day helpers and date-range presets for the
 * Watson Sales Report. All reporting boundaries use LA civil days (DST-aware),
 * regardless of the server timezone.
 */

export const SALES_REPORT_TZ = "America/Los_Angeles";

/** Calendar day span before which custom ranges are rejected (protects queries). */
export const MAX_CUSTOM_RANGE_DAYS = 366;

/**
 * Fallback synced Shopify data is stale if the last successful sync is older
 * than one scheduled interval (cron is every 6 hours).
 */
export const SHOPIFY_STALE_HOURS = 6;

export type SalesRangePreset =
  | "today"
  | "yesterday"
  | "last3"
  | "last7"
  | "month"
  | "custom";

export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export interface DayRange {
  preset: SalesRangePreset;
  /** Inclusive first LA calendar day, "YYYY-MM-DD". */
  fromCivil: string;
  /** Inclusive last LA calendar day, "YYYY-MM-DD". */
  toCivil: string;
  /** Inclusive UTC instant for the start of fromCivil (LA midnight). */
  startUtc: Date;
  /** Exclusive UTC instant for the end of toCivil (LA midnight of the next day). */
  endUtc: Date;
  /** LA calendar day that is "today" relative to the resolving instant. */
  todayCivil: string;
  label: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const laFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SALES_REPORT_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface LaParts extends CivilDate {
  hour: number;
  minute: number;
  second: number;
}

function laParts(instant: Date): LaParts {
  const parts: Record<string, string> = {};
  for (const part of laFormatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  // Some engines emit "24" for midnight; normalize to 0.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Offset in ms between LA wall-clock time and UTC at a given instant
 * (negative west of UTC, e.g. -7h during PDT, -8h during PST).
 */
function laOffsetMs(instant: Date): number {
  const p = laParts(instant);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function civilToString(civil: CivilDate): string {
  return `${civil.year}-${pad2(civil.month)}-${pad2(civil.day)}`;
}

/** The LA calendar date of an instant. */
export function laCivilDateOf(instant: Date): CivilDate {
  const p = laParts(instant);
  return { year: p.year, month: p.month, day: p.day };
}

/** LA calendar day key ("YYYY-MM-DD") for bucketing a timestamp. */
export function civilDayKey(instant: Date): string {
  return civilToString(laCivilDateOf(instant));
}

/** UTC instant for the start (LA midnight) of a civil date. */
export function laCivilMidnightUtc(civil: CivilDate): Date {
  const naiveUtc = Date.UTC(civil.year, civil.month - 1, civil.day, 0, 0, 0);
  const offset = laOffsetMs(new Date(naiveUtc));
  return new Date(naiveUtc - offset);
}

/** Pure calendar arithmetic (timezone independent). */
export function addCivilDays(civil: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Strictly parse a "YYYY-MM-DD" civil date; returns null if invalid. */
export function parseCivil(value: string | null | undefined): CivilDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible dates (e.g. 2026-02-31).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Compare civil dates: negative if a < b, 0 if equal, positive if a > b. */
export function compareCivil(a: CivilDate, b: CivilDate): number {
  return (
    Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)
  );
}

/** Number of days between two civil dates (b - a). */
export function civilDaySpan(a: CivilDate, b: CivilDate): number {
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Inclusive list of civil day keys from `fromCivil` to `toCivil`. */
export function eachCivilDay(fromCivil: string, toCivil: string): string[] {
  const from = parseCivil(fromCivil);
  const to = parseCivil(toCivil);
  if (!from || !to || compareCivil(from, to) > 0) return [];
  const out: string[] = [];
  let cursor = from;
  // Guard against pathological ranges.
  for (let i = 0; i <= MAX_CUSTOM_RANGE_DAYS + 1; i += 1) {
    out.push(civilToString(cursor));
    if (compareCivil(cursor, to) === 0) break;
    cursor = addCivilDays(cursor, 1);
  }
  return out;
}

export function formatCivilLabel(value: string): string {
  const civil = parseCivil(value);
  if (!civil) return value;
  return `${MONTH_NAMES[civil.month - 1]} ${civil.day}, ${civil.year}`;
}

/**
 * Wall-clock display formatter for America/Los_Angeles that includes the
 * timezone abbreviation (e.g. "PDT"/"PST"), so freshness stamps are unambiguous
 * regardless of the server timezone. `timeZoneName` cannot be combined with
 * `dateStyle`/`timeStyle`, so explicit component options are used instead.
 */
const laDisplayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SALES_REPORT_TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

/**
 * Format an instant as a human-readable America/Los_Angeles timestamp with an
 * explicit timezone abbreviation, e.g. "Aug 1, 2026, 1:00 PM PDT". Returns "-"
 * for nullish/empty input and echoes the original string if it cannot be parsed.
 */
export function formatLaTimestamp(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "-";
  return laDisplayFormatter.format(date);
}

function rangeLabel(preset: SalesRangePreset, from: string, to: string): string {
  const presetName: Record<SalesRangePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last3: "Last 3 Days",
    last7: "Last 7 Days",
    month: "This Month",
    custom: "Custom",
  };
  if (from === to) {
    return `${presetName[preset]} (${formatCivilLabel(from)})`;
  }
  return `${presetName[preset]} (${formatCivilLabel(from)} - ${formatCivilLabel(to)})`;
}

function buildRange(
  preset: SalesRangePreset,
  fromCivil: CivilDate,
  toCivil: CivilDate,
  todayCivil: CivilDate,
): DayRange {
  const fromStr = civilToString(fromCivil);
  const toStr = civilToString(toCivil);
  return {
    preset,
    fromCivil: fromStr,
    toCivil: toStr,
    startUtc: laCivilMidnightUtc(fromCivil),
    endUtc: laCivilMidnightUtc(addCivilDays(toCivil, 1)),
    todayCivil: civilToString(todayCivil),
    label: rangeLabel(preset, fromStr, toStr),
  };
}

export interface ResolveRangeInput {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}

export type ResolveRangeResult =
  | { ok: true; range: DayRange }
  | { ok: false; error: string };

/**
 * Resolve query parameters into an LA calendar-day range. Defaults to the last
 * 3 days (including today). Validates custom ranges.
 */
export function resolveDayRange(
  input: ResolveRangeInput = {},
  now: Date = new Date(),
): ResolveRangeResult {
  const today = laCivilDateOf(now);
  const rawPreset = (input.preset ?? "").trim().toLowerCase();
  const preset: SalesRangePreset =
    rawPreset === "today" ||
    rawPreset === "yesterday" ||
    rawPreset === "last3" ||
    rawPreset === "last7" ||
    rawPreset === "month" ||
    rawPreset === "custom"
      ? (rawPreset as SalesRangePreset)
      : "last3";

  switch (preset) {
    case "today":
      return { ok: true, range: buildRange("today", today, today, today) };
    case "yesterday": {
      const yesterday = addCivilDays(today, -1);
      return { ok: true, range: buildRange("yesterday", yesterday, yesterday, today) };
    }
    case "last7":
      return {
        ok: true,
        range: buildRange("last7", addCivilDays(today, -6), today, today),
      };
    case "month":
      return {
        ok: true,
        range: buildRange("month", { year: today.year, month: today.month, day: 1 }, today, today),
      };
    case "custom": {
      const from = parseCivil(input.from);
      const to = parseCivil(input.to);
      if (!from || !to) {
        return {
          ok: false,
          error: "Custom range requires valid From and To dates (YYYY-MM-DD).",
        };
      }
      if (compareCivil(from, to) > 0) {
        return { ok: false, error: "Custom range From date must be on or before the To date." };
      }
      if (compareCivil(to, today) > 0) {
        return { ok: false, error: "Custom range To date cannot be in the future." };
      }
      if (civilDaySpan(from, to) + 1 > MAX_CUSTOM_RANGE_DAYS) {
        return {
          ok: false,
          error: `Custom range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days.`,
        };
      }
      return { ok: true, range: buildRange("custom", from, to, today) };
    }
    case "last3":
    default:
      return {
        ok: true,
        range: buildRange("last3", addCivilDays(today, -2), today, today),
      };
  }
}
