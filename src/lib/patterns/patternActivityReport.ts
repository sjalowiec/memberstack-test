/**
 * Pure admin-report helpers for Pattern Activity: date ranges, filters, sort.
 */
import {
  PATTERN_SYSTEM_DISPLAY_NAMES,
  type PatternSystemId,
} from "./patternSystemId";
import {
  membershipFromActivityEvent,
  membershipLabel,
  type PatternActivityMembership,
} from "./patternActivityIdentity";
import {
  PATTERN_ACTIVITY_EVENT_TYPES,
  type PatternActivityEvent,
  type PatternActivityEventType,
} from "./patternActivityLog";

export type PatternActivityDatePreset = "today" | "week" | "month" | "all" | "custom";

export type PatternActivitySortKey =
  | "createdAt"
  | "userEmail"
  | "membership"
  | "eventType"
  | "patternSystem"
  | "patternTitle";

export type PatternActivitySortDirection = "asc" | "desc";

export interface PatternActivityReportFilters {
  datePreset: PatternActivityDatePreset;
  customFrom?: string;
  customTo?: string;
  patternSystem: string;
  membership: "all" | PatternActivityMembership | "unknown";
  eventType: string;
}

export interface PatternActivityDateRange {
  fromIso?: string;
  toIso?: string;
}

export const PATTERN_ACTIVITY_EVENT_LABELS: Record<string, string> = {
  pattern_started: "Started",
  pattern_generated: "Generated",
  pattern_saved: "Saved",
  pattern_updated: "Updated",
  pattern_opened: "Opened",
  pattern_printed: "Printed",
};

export function patternActivityEventLabel(eventType: string): string {
  return PATTERN_ACTIVITY_EVENT_LABELS[eventType] ?? eventType;
}

export function patternActivitySystemLabel(system: string): string {
  const known = PATTERN_SYSTEM_DISPLAY_NAMES[system as keyof typeof PATTERN_SYSTEM_DISPLAY_NAMES];
  if (known) return known;
  if (!system.trim()) return "—";
  return system
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfLocalWeek(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function parseLocalDateInput(value: string | undefined): Date | null {
  const trimmed = value?.trim() ?? "";
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function dateRangeForPreset(
  preset: PatternActivityDatePreset,
  now: Date = new Date(),
  custom?: { from?: string; to?: string },
): PatternActivityDateRange {
  if (preset === "all") return {};
  if (preset === "custom") {
    const fromDate = parseLocalDateInput(custom?.from);
    const toDate = parseLocalDateInput(custom?.to);
    if (!fromDate && !toDate) return {};
    const from = fromDate ? startOfLocalDay(fromDate) : undefined;
    const to = toDate ? endOfLocalDay(toDate) : undefined;
    if (from && to && from.getTime() > to.getTime()) {
      return { fromIso: startOfLocalDay(toDate!).toISOString(), toIso: endOfLocalDay(fromDate!).toISOString() };
    }
    return {
      fromIso: from?.toISOString(),
      toIso: to?.toISOString(),
    };
  }
  if (preset === "today") {
    return {
      fromIso: startOfLocalDay(now).toISOString(),
      toIso: endOfLocalDay(now).toISOString(),
    };
  }
  if (preset === "week") {
    return {
      fromIso: startOfLocalWeek(now).toISOString(),
      toIso: endOfLocalDay(now).toISOString(),
    };
  }
  return {
    fromIso: startOfLocalMonth(now).toISOString(),
    toIso: endOfLocalDay(now).toISOString(),
  };
}

export function eventMatchesDateRange(
  event: Pick<PatternActivityEvent, "createdAt">,
  range: PatternActivityDateRange,
): boolean {
  if (range.fromIso && event.createdAt < range.fromIso) return false;
  if (range.toIso && event.createdAt > range.toIso) return false;
  return true;
}

export function filterPatternActivityEvents(
  events: readonly PatternActivityEvent[],
  filters: PatternActivityReportFilters,
  now: Date = new Date(),
): PatternActivityEvent[] {
  const range = dateRangeForPreset(filters.datePreset, now, {
    from: filters.customFrom,
    to: filters.customTo,
  });
  return events.filter((event) => {
    if (!eventMatchesDateRange(event, range)) return false;
    if (filters.patternSystem && event.patternSystem !== filters.patternSystem) return false;
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    if (filters.membership !== "all") {
      if (membershipFromActivityEvent(event) !== filters.membership) return false;
    }
    return true;
  });
}

function sortValue(
  event: PatternActivityEvent,
  key: PatternActivitySortKey,
): string {
  if (key === "createdAt") return event.createdAt;
  if (key === "userEmail") return (event.userEmail ?? "").toLowerCase();
  if (key === "membership") return membershipFromActivityEvent(event);
  if (key === "eventType") return event.eventType;
  if (key === "patternSystem") return event.patternSystem ?? "";
  return (event.patternTitle ?? "").toLowerCase();
}

export function sortPatternActivityEvents(
  events: readonly PatternActivityEvent[],
  key: PatternActivitySortKey = "createdAt",
  direction: PatternActivitySortDirection = "desc",
): PatternActivityEvent[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left < right) return -1 * sign;
    if (left > right) return 1 * sign;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Active production systems that must always appear in the admin filter,
 * even when the loaded log has no events for them yet.
 * Labels come from {@link PATTERN_SYSTEM_DISPLAY_NAMES}.
 */
export const PATTERN_ACTIVITY_FILTER_SYSTEMS: readonly PatternSystemId[] = [
  "hat",
  "sleeveless",
  "drop-shoulder",
];

export function patternActivitySystemFilterOptions(
  events: readonly Pick<PatternActivityEvent, "patternSystem">[] = [],
): { value: string; label: string }[] {
  const systems = new Set<string>(PATTERN_ACTIVITY_FILTER_SYSTEMS);
  for (const event of events) {
    const system = event.patternSystem?.trim();
    if (system) systems.add(system);
  }
  return [...systems]
    .sort((a, b) => patternActivitySystemLabel(a).localeCompare(patternActivitySystemLabel(b)))
    .map((value) => ({ value, label: patternActivitySystemLabel(value) }));
}

/** @deprecated Use {@link patternActivitySystemFilterOptions}. */
export function patternSystemsFromEvents(
  events: readonly Pick<PatternActivityEvent, "patternSystem">[],
): { value: string; label: string }[] {
  return patternActivitySystemFilterOptions(events);
}

export function patternActivityEventTypeOptions(): {
  value: PatternActivityEventType;
  label: string;
}[] {
  return PATTERN_ACTIVITY_EVENT_TYPES.map((value) => ({
    value,
    label: patternActivityEventLabel(value),
  }));
}

export function activityMembershipDisplay(
  event: { metadata?: Record<string, unknown> } | null | undefined,
): "Free" | "Member" | "Unknown" {
  return membershipLabel(membershipFromActivityEvent(event));
}

export const DEFAULT_PATTERN_ACTIVITY_FILTERS: PatternActivityReportFilters = {
  datePreset: "week",
  patternSystem: "",
  membership: "all",
  eventType: "",
};
