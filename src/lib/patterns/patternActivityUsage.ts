/**
 * Watson Pattern Activity usage totals.
 * Counts events already stored. Does not invent generations that were never recorded.
 */
import {
  membershipFromActivityEvent,
  PATTERN_ACTIVITY_GUEST_USER_PREFIX,
} from "./patternActivityIdentity";
import type { PatternActivityEvent, PatternActivityEventType } from "./patternActivityLog";
import { PATTERN_SYSTEM_IDS, type PatternSystemId } from "./patternSystemId";
import {
  dateRangeForPreset,
  eventMatchesDateRange,
  patternActivitySystemLabel,
  type PatternActivityDatePreset,
} from "./patternActivityReport";

/** Live owner account. Excluded only when the Watson viewer turns the option on. */
export const SUE_PATTERN_ACTIVITY_MEMBER_ID = "mem_cms4tl24v00eb0sqx143i4a9r";
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
  event: Pick<PatternActivityEvent, "userId" | "userEmail">,
): boolean {
  if (event.userId === SUE_PATTERN_ACTIVITY_MEMBER_ID) return true;
  return (event.userEmail ?? "").trim().toLowerCase() === SUE_PATTERN_ACTIVITY_EMAIL;
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

export function activityMembershipNote(
  event: { metadata?: Record<string, unknown> } | null | undefined,
): string {
  return membershipFromActivityEvent(event);
}

/** How a stored user id can be recognized. Access is not inferred from the pattern. */
export type PatternActivityPersonIdentity = "signed-in" | "guest" | "not-established";

export type PatternActivityPatternGroup = "free-hat" | "member-pattern" | "unknown";

export interface PatternActivityPatternTotals {
  /** Distinct mem_ accounts that generated or saved. Guests are not included. */
  signedInPeople: number;
  /** Distinct guest ids that generated or saved. */
  guestPeople: number;
  /** Distinct other ids that generated or saved. The account is not established. */
  identityNotEstablished: number;
  generations: number;
  distinctSavedProjects: number;
  opens: number;
  edits: number;
  prints: number;
}

export interface PatternActivityPatternRow extends PatternActivityPatternTotals {
  /** Display name. Unmapped identifiers use "Unknown". */
  label: string;
  /** Raw patternSystem values in this row. Blank values are shown as "(blank)". */
  identifiers: string[];
  group: PatternActivityPatternGroup;
}

export interface PatternActivityPatternSummary {
  rows: PatternActivityPatternRow[];
  freeHat: PatternActivityPatternTotals;
  memberPatterns: PatternActivityPatternTotals;
  unknown: PatternActivityPatternTotals;
  /** Same filters as {@link buildPatternActivityUsage}. Distinct counts are unions, not sums of rows. */
  overall: PatternActivityPatternTotals;
  /**
   * True when every filtered event is in exactly one row and the row event counts
   * equal the existing usage totals. Distinct people and saved projects match as unions.
   */
  matchesExistingTotals: boolean;
}

const KNOWN_PATTERN_SYSTEMS = new Set<string>(PATTERN_SYSTEM_IDS);

export function patternActivityPersonIdentity(userId: string): PatternActivityPersonIdentity {
  const id = userId.trim();
  if (id.startsWith("mem_")) return "signed-in";
  if (id.startsWith(PATTERN_ACTIVITY_GUEST_USER_PREFIX)) return "guest";
  return "not-established";
}

export function patternActivityPatternGroup(patternSystem: string): PatternActivityPatternGroup {
  const id = patternSystem.trim();
  if (id === "hat") return "free-hat";
  if (KNOWN_PATTERN_SYSTEMS.has(id)) return "member-pattern";
  return "unknown";
}

interface PatternCountBucket {
  identifiers: Set<string>;
  signedInPeople: Set<string>;
  guestPeople: Set<string>;
  identityNotEstablished: Set<string>;
  generations: number;
  savedProjects: Set<string>;
  opens: number;
  edits: number;
  prints: number;
}

function emptyPatternBucket(): PatternCountBucket {
  return {
    identifiers: new Set(),
    signedInPeople: new Set(),
    guestPeople: new Set(),
    identityNotEstablished: new Set(),
    generations: 0,
    savedProjects: new Set(),
    opens: 0,
    edits: 0,
    prints: 0,
  };
}

function rememberIdentifier(bucket: PatternCountBucket, patternSystem: string): void {
  const trimmed = patternSystem.trim();
  bucket.identifiers.add(trimmed || "(blank)");
}

function applyPatternEvent(bucket: PatternCountBucket, event: PatternActivityEvent): void {
  const generatedOrSaved =
    event.eventType === "pattern_generated" || event.eventType === "pattern_saved";
  if (generatedOrSaved) {
    const identity = patternActivityPersonIdentity(event.userId);
    if (identity === "signed-in") bucket.signedInPeople.add(event.userId);
    else if (identity === "guest") bucket.guestPeople.add(event.userId);
    else bucket.identityNotEstablished.add(event.userId);
  }
  if (event.eventType === "pattern_generated") bucket.generations += 1;
  if (event.eventType === "pattern_saved" && event.patternId) bucket.savedProjects.add(event.patternId);
  if (event.eventType === "pattern_opened") bucket.opens += 1;
  if (event.eventType === "pattern_updated") bucket.edits += 1;
  if (event.eventType === "pattern_printed") bucket.prints += 1;
}

function totalsFromBuckets(buckets: readonly PatternCountBucket[]): PatternActivityPatternTotals {
  const signedInPeople = new Set<string>();
  const guestPeople = new Set<string>();
  const identityNotEstablished = new Set<string>();
  const savedProjects = new Set<string>();
  let generations = 0;
  let opens = 0;
  let edits = 0;
  let prints = 0;
  for (const bucket of buckets) {
    for (const id of bucket.signedInPeople) signedInPeople.add(id);
    for (const id of bucket.guestPeople) guestPeople.add(id);
    for (const id of bucket.identityNotEstablished) identityNotEstablished.add(id);
    for (const id of bucket.savedProjects) savedProjects.add(id);
    generations += bucket.generations;
    opens += bucket.opens;
    edits += bucket.edits;
    prints += bucket.prints;
  }
  return {
    signedInPeople: signedInPeople.size,
    guestPeople: guestPeople.size,
    identityNotEstablished: identityNotEstablished.size,
    generations,
    distinctSavedProjects: savedProjects.size,
    opens,
    edits,
    prints,
  };
}

function rowFromBucket(
  label: string,
  group: PatternActivityPatternGroup,
  bucket: PatternCountBucket,
): PatternActivityPatternRow {
  const totals = totalsFromBuckets([bucket]);
  return {
    label,
    identifiers: [...bucket.identifiers].sort((a, b) => a.localeCompare(b)),
    group,
    ...totals,
  };
}

function knownSystemId(patternSystem: string): PatternSystemId | null {
  const id = patternSystem.trim();
  return KNOWN_PATTERN_SYSTEMS.has(id) ? (id as PatternSystemId) : null;
}

/**
 * One row per known pattern identifier, plus a single Unknown row for every
 * identifier that is not in {@link PATTERN_SYSTEM_IDS}. Event counts sum to the
 * existing usage totals. A person who used two patterns is counted in each row
 * and once in the overall union.
 */
export function buildPatternActivityPatternSummary(
  events: readonly PatternActivityEvent[],
  filters: PatternActivityUsageFilters,
  now: Date = new Date(),
): PatternActivityPatternSummary {
  const usage = buildPatternActivityUsage(events, filters, now);
  const filtered = filterPatternActivityUsageEvents(events, filters, now);
  const known = new Map<PatternSystemId, PatternCountBucket>();
  const unknown = emptyPatternBucket();

  for (const event of filtered) {
    const system = knownSystemId(event.patternSystem ?? "");
    if (!system) {
      rememberIdentifier(unknown, event.patternSystem ?? "");
      applyPatternEvent(unknown, event);
      continue;
    }
    const bucket = known.get(system) ?? emptyPatternBucket();
    rememberIdentifier(bucket, system);
    applyPatternEvent(bucket, event);
    known.set(system, bucket);
  }

  const rows = [...known.entries()].map(([system, bucket]) =>
    rowFromBucket(
      patternActivitySystemLabel(system),
      system === "hat" ? "free-hat" : "member-pattern",
      bucket,
    ),
  );
  if (unknown.identifiers.size > 0) {
    rows.push(rowFromBucket("Unknown", "unknown", unknown));
  }
  rows.sort((a, b) => {
    if (b.signedInPeople !== a.signedInPeople) return b.signedInPeople - a.signedInPeople;
    if (b.generations !== a.generations) return b.generations - a.generations;
    return a.label.localeCompare(b.label);
  });

  const freeHatBucket = known.get("hat");
  const memberBuckets = [...known.entries()]
    .filter(([system]) => system !== "hat")
    .map(([, bucket]) => bucket);
  const allBuckets = [...known.values()];
  if (unknown.identifiers.size > 0) allBuckets.push(unknown);

  const overall = totalsFromBuckets(allBuckets);
  const freeHat = totalsFromBuckets(freeHatBucket ? [freeHatBucket] : []);
  const memberPatterns = totalsFromBuckets(memberBuckets);
  const unknownTotals = totalsFromBuckets(unknown.identifiers.size > 0 ? [unknown] : []);
  const rowGenerations = rows.reduce((sum, row) => sum + row.generations, 0);
  const rowOpens = rows.reduce((sum, row) => sum + row.opens, 0);
  const rowEdits = rows.reduce((sum, row) => sum + row.edits, 0);
  const rowPrints = rows.reduce((sum, row) => sum + row.prints, 0);
  const groupedGenerations = freeHat.generations + memberPatterns.generations + unknownTotals.generations;
  const groupedOpens = freeHat.opens + memberPatterns.opens + unknownTotals.opens;
  const groupedEdits = freeHat.edits + memberPatterns.edits + unknownTotals.edits;
  const groupedPrints = freeHat.prints + memberPatterns.prints + unknownTotals.prints;

  const matchesExistingTotals =
    overall.signedInPeople === usage.peopleWhoGeneratedOrSaved &&
    overall.generations === usage.totalGenerations &&
    overall.distinctSavedProjects === usage.distinctSavedProjects &&
    overall.opens === usage.opens &&
    overall.edits === usage.edits &&
    overall.prints === usage.prints &&
    rowGenerations === usage.totalGenerations &&
    rowOpens === usage.opens &&
    rowEdits === usage.edits &&
    rowPrints === usage.prints &&
    groupedGenerations === usage.totalGenerations &&
    groupedOpens === usage.opens &&
    groupedEdits === usage.edits &&
    groupedPrints === usage.prints;

  return {
    rows,
    freeHat,
    memberPatterns,
    unknown: unknownTotals,
    overall,
    matchesExistingTotals,
  };
}

/**
 * Patterns that have historical `pattern_generated` events on production.
 * Identifiers checked against the live log: hat, sleeveless, drop-shoulder, socks.
 */
export const PATTERN_BUILD_SYSTEMS = ["hat", "sleeveless", "drop-shoulder", "socks"] as const;

export type PatternBuildSystem = (typeof PATTERN_BUILD_SYSTEMS)[number];

export interface PatternBuildRow {
  key: string;
  label: string;
  /** Distinct stored ids with a pattern_generated event. Not opens, saves, edits, prints, or starts. */
  peopleWhoBuilt: number;
  /** Every pattern_generated event, including repeat builds by the same id. */
  patternsGenerated: number;
}

export interface PatternBuildReport {
  rows: PatternBuildRow[];
  /** Hat generations whose id is neither a guest id nor a signed-in account id. */
  hatIdentityNotEstablished: PatternBuildRow | null;
  /** Generation events whose pattern identifier is not one of the four rows. */
  otherPatterns: PatternBuildRow[];
}

interface BuildCountBucket {
  people: Set<string>;
  generations: number;
}

function emptyBuildCount(): BuildCountBucket {
  return { people: new Set(), generations: 0 };
}

function buildRow(key: string, label: string, bucket: BuildCountBucket): PatternBuildRow {
  return {
    key,
    label,
    peopleWhoBuilt: bucket.people.size,
    patternsGenerated: bucket.generations,
  };
}

function addGeneration(bucket: BuildCountBucket, userId: string): void {
  bucket.people.add(userId);
  bucket.generations += 1;
}

/**
 * Counts who built each pattern. Only `pattern_generated` events count.
 * Hat is split into guest ids and signed-in account ids. Signed-in does not
 * mean a paid membership; membership on the event is often missing.
 */
export function buildPatternBuildReport(
  events: readonly PatternActivityEvent[],
  filters: PatternActivityUsageFilters,
  now: Date = new Date(),
): PatternBuildReport {
  const filtered = filterPatternActivityUsageEvents(events, filters, now);
  const hat = {
    guest: emptyBuildCount(),
    signedIn: emptyBuildCount(),
    other: emptyBuildCount(),
  };
  const named = {
    sleeveless: emptyBuildCount(),
    "drop-shoulder": emptyBuildCount(),
    socks: emptyBuildCount(),
  };
  const other = new Map<string, BuildCountBucket>();

  for (const event of filtered) {
    if (event.eventType !== "pattern_generated") continue;
    const system = (event.patternSystem ?? "").trim();
    if (system === "hat") {
      const identity = patternActivityPersonIdentity(event.userId);
      if (identity === "guest") addGeneration(hat.guest, event.userId);
      else if (identity === "signed-in") addGeneration(hat.signedIn, event.userId);
      else addGeneration(hat.other, event.userId);
      continue;
    }
    if (system === "sleeveless" || system === "drop-shoulder" || system === "socks") {
      addGeneration(named[system], event.userId);
      continue;
    }
    const key = system || "(blank)";
    const bucket = other.get(key) ?? emptyBuildCount();
    addGeneration(bucket, event.userId);
    other.set(key, bucket);
  }

  const hatOther = buildRow("hat-other", "Hat — identity not established", hat.other);
  return {
    rows: [
      buildRow("hat-guest", "Hat — guest identities", hat.guest),
      buildRow("hat-signed-in", "Hat — signed-in people", hat.signedIn),
      buildRow("sleeveless", patternActivitySystemLabel("sleeveless"), named.sleeveless),
      buildRow("drop-shoulder", patternActivitySystemLabel("drop-shoulder"), named["drop-shoulder"]),
      buildRow("socks", patternActivitySystemLabel("socks"), named.socks),
    ],
    hatIdentityNotEstablished: hatOther.patternsGenerated > 0 ? hatOther : null,
    otherPatterns: [...other.entries()]
      .map(([system, bucket]) => buildRow(system, patternActivitySystemLabel(system), bucket))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}
