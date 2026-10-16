/**
 * Watson Pattern Activity usage totals.
 * Counts events already stored. Does not invent generations that were never recorded.
 */
import {
  membershipFromActivityEvent,
  PATTERN_ACTIVITY_GUEST_USER_PREFIX,
} from "./patternActivityIdentity";
import type { PatternActivityEvent, PatternActivityEventType } from "./patternActivityLog";
import {
  dateRangeForPreset,
  eventMatchesDateRange,
  watsonPatternActivityDateRange,
  type PatternActivityDatePreset,
  type PatternActivityDateRange,
} from "./patternActivityReport";

/**
 * Verified live Memberstack id for Sue’s account.
 * The Watson report excludes this id unless “Include Sue’s activity” is checked.
 * Match this account id only — never a display name, pattern title, or email label.
 */
export const SUE_PATTERN_ACTIVITY_MEMBER_ID = "mem_cms4tl24v00eb0sqx143i4a9r";
/** Account email. Not used to decide exclusion. */
export const SUE_PATTERN_ACTIVITY_EMAIL = "sue@knititnow.com";

export interface PatternActivityUsageFilters {
  datePreset: PatternActivityDatePreset;
  customFrom?: string;
  customTo?: string;
  patternSystem: string;
  excludeSue: boolean;
}

export interface PatternActivityPersonAction {
  createdAt: string;
  eventType: PatternActivityEventType | string;
  patternSystem: string;
  patternId?: string;
  patternTitle?: string;
}

export interface PatternActivityPersonUsage {
  kind: "member" | "anonymous";
  /** Email when the event stored one. Never a guest hash. */
  label: string;
  memberId?: string;
  capturedEmail?: string;
  patterns: string[];
  firstAt?: string;
  lastAt?: string;
  actions: PatternActivityPersonAction[];
}

export interface PatternActivityUsageReport {
  peopleWhoGeneratedOrSaved: number;
  totalGenerations: number;
  distinctSavedProjects: number;
  opens: number;
  edits: number;
  prints: number;
  people: PatternActivityPersonUsage[];
  anonymous: PatternActivityPersonUsage[];
}

export function isSuePatternActivityEvent(
  event: Pick<PatternActivityEvent, "userId" | "metadata">,
): boolean {
  if (event.userId === SUE_PATTERN_ACTIVITY_MEMBER_ID) return true;
  return event.metadata?.memberId === SUE_PATTERN_ACTIVITY_MEMBER_ID;
}

/** Unchecked “Include Sue’s activity” excludes her account before any totals. */
export function excludeSuePatternActivity(includeSue: boolean): boolean {
  return includeSue !== true;
}

export function isAnonymousPatternActivityUser(userId: string): boolean {
  const id = userId.trim();
  if (!id) return true;
  if (id.startsWith(PATTERN_ACTIVITY_GUEST_USER_PREFIX)) return true;
  return !id.startsWith("mem_");
}

function patternLabel(event: Pick<PatternActivityEvent, "patternTitle" | "patternSystem" | "patternId">): string {
  const title = event.patternTitle?.trim();
  if (title) return title;
  const system = event.patternSystem?.trim();
  if (system) return system;
  return event.patternId?.trim() || "Pattern";
}

export function filterPatternActivityUsageEvents(
  events: readonly PatternActivityEvent[],
  filters: PatternActivityUsageFilters,
  now: Date = new Date(),
): PatternActivityEvent[] {
  const range = dateRangeForPreset(filters.datePreset, now, {
    from: filters.customFrom,
    to: filters.customTo,
  });
  return events.filter((event) => {
    if (!eventMatchesDateRange(event, range)) return false;
    if (filters.patternSystem && event.patternSystem !== filters.patternSystem) return false;
    if (filters.excludeSue && isSuePatternActivityEvent(event)) return false;
    return true;
  });
}

function personLabel(events: PatternActivityEvent[], anonymous: boolean): string {
  const email = events.map((event) => event.userEmail?.trim()).find(Boolean);
  if (anonymous) return email || "Anonymous visitor";
  return email || "Member";
}

function buildPerson(userId: string, events: PatternActivityEvent[]): PatternActivityPersonUsage {
  const anonymous = isAnonymousPatternActivityUser(userId);
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const patterns = [...new Set(sorted.map(patternLabel))];
  const email = sorted.map((event) => event.userEmail?.trim()).find(Boolean);
  return {
    kind: anonymous ? "anonymous" : "member",
    label: personLabel(sorted, anonymous),
    memberId: anonymous ? undefined : userId,
    capturedEmail: anonymous ? email : undefined,
    patterns,
    firstAt: sorted[0]?.createdAt,
    lastAt: sorted[sorted.length - 1]?.createdAt,
    actions: sorted.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      patternSystem: event.patternSystem,
      patternId: event.patternId,
      patternTitle: event.patternTitle,
    })),
  };
}

export function buildPatternActivityUsage(
  events: readonly PatternActivityEvent[],
  filters: PatternActivityUsageFilters,
  now: Date = new Date(),
): PatternActivityUsageReport {
  const filtered = filterPatternActivityUsageEvents(events, filters, now);
  const byUser = new Map<string, PatternActivityEvent[]>();
  const savedProjectIds = new Set<string>();
  const generatedOrSavedUsers = new Set<string>();
  let totalGenerations = 0;
  let opens = 0;
  let edits = 0;
  let prints = 0;

  for (const event of filtered) {
    const bucket = byUser.get(event.userId) ?? [];
    bucket.push(event);
    byUser.set(event.userId, bucket);
    if (event.eventType === "pattern_generated") {
      totalGenerations += 1;
      if (!isAnonymousPatternActivityUser(event.userId)) generatedOrSavedUsers.add(event.userId);
    }
    if (event.eventType === "pattern_saved") {
      if (event.patternId) savedProjectIds.add(event.patternId);
      if (!isAnonymousPatternActivityUser(event.userId)) generatedOrSavedUsers.add(event.userId);
    }
    if (event.eventType === "pattern_opened") opens += 1;
    if (event.eventType === "pattern_updated") edits += 1;
    if (event.eventType === "pattern_printed") prints += 1;
  }

  const people: PatternActivityPersonUsage[] = [];
  const anonymous: PatternActivityPersonUsage[] = [];
  for (const [userId, rows] of byUser) {
    const person = buildPerson(userId, rows);
    if (person.kind === "anonymous") anonymous.push(person);
    else people.push(person);
  }
  const byLast = (a: PatternActivityPersonUsage, b: PatternActivityPersonUsage) =>
    (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
  people.sort(byLast);
  anonymous.sort(byLast);

  return {
    peopleWhoGeneratedOrSaved: generatedOrSavedUsers.size,
    totalGenerations,
    distinctSavedProjects: savedProjectIds.size,
    opens,
    edits,
    prints,
    people,
    anonymous,
  };
}

export interface WatsonPatternActivityViewInput {
  datePreset: PatternActivityDatePreset | "";
  customFrom?: string;
  customTo?: string;
  patternSystem: string;
  /** Checkbox state. Unchecked is the initial report and excludes Sue’s account id. */
  includeSue: boolean;
}

/**
 * Date range plus usage totals for the Watson report.
 * The range is applied first, then Sue’s account id is removed when includeSue
 * is not checked, and only then are counts and member lists calculated.
 * includeSue is independent of the date and pattern filters.
 */
export function buildWatsonPatternActivityReport(
  events: readonly PatternActivityEvent[],
  input: WatsonPatternActivityViewInput,
  now: Date = new Date(),
): { range: PatternActivityDateRange; report: PatternActivityUsageReport } {
  const range = watsonPatternActivityDateRange(input.datePreset, now, {
    from: input.customFrom,
    to: input.customTo,
  });
  const report = buildPatternActivityUsage(
    events.filter((event) => eventMatchesDateRange(event, range)),
    {
      datePreset: "all",
      patternSystem: input.patternSystem,
      excludeSue: excludeSuePatternActivity(input.includeSue),
    },
    now,
  );
  return { range, report };
}

export function activityMembershipNote(
  event: { metadata?: Record<string, unknown> } | null | undefined,
): string {
  return membershipFromActivityEvent(event);
}
