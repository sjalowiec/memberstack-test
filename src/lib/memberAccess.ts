/**
 * Global membership access ? the single source of truth for member-only gating.
 *
 * The GLOBAL RULE (used by every gated section: videos, tools, skill builders,
 * stitches/downloads, custom pattern systems, ?):
 *
 *   Member access is granted only when the visitor is LOGGED IN **and** has a
 *   currently valid membership:
 *
 *   - An ACTIVE/TRIALING paid plan (current membership or retired paid shells), or
 *   - The free legacy membership plan **and** a Watson paid-through date that is
 *     today or in the future (America/Los_Angeles calendar day).
 *
 * Merely having a legacy plan connection or a legacy membership record does not
 * grant access. Retired KIN Beta Access does not count. Login alone never grants
 * member access.
 *
 * Paid plan ids live in `src/config/memberships.ts`. Do NOT keep a separate plan
 * list in any section.
 */
import {
  CURRENT_MEMBER_PLAN_IDS,
  FREE_ACCESS_MEMBER_PLAN_IDS,
  LEGACY_PAID_MEMBER_PLAN_IDS,
  MEMBER_PLAN_IDS,
} from "../config/memberships";
import {
  memberEmailFromMemberstackPayload,
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

/** Global allow list of Memberstack plan ids that *can* grant member access. */
export const MEMBER_ACCESS_PLAN_IDS = MEMBER_PLAN_IDS;

/** Paid plans that grant access from Memberstack ACTIVE/TRIALING alone. */
export const PAID_MEMBER_ACCESS_PLAN_IDS = [
  ...CURRENT_MEMBER_PLAN_IDS,
  ...LEGACY_PAID_MEMBER_PLAN_IDS,
] as const;

/** Free legacy plan ids that also require a valid Watson paid-through date. */
export const FREE_LEGACY_MEMBER_ACCESS_PLAN_IDS = FREE_ACCESS_MEMBER_PLAN_IDS;

export { MEMBER_PLAN_IDS };

/** Business calendar for legacy paid-through vs expired (date-only, not timestamps). */
export const MEMBER_ACCESS_CALENDAR_TIMEZONE = "America/Los_Angeles";

const paidPlanIds = new Set<string>(PAID_MEMBER_ACCESS_PLAN_IDS);
const freeLegacyPlanIds = new Set<string>(FREE_LEGACY_MEMBER_ACCESS_PLAN_IDS);

/** Resolved viewer state for any gated area. */
export type ViewerAccessState = "loggedOut" | "loggedInNoAccess" | "memberAccess";

export type MemberAccessOptions = {
  /**
   * Watson `legacy_members.subscriptionexpiring` as YYYY-MM-DD.
   * Required to grant access via the free legacy plan. Ignored for paid plans.
   */
  legacyPaidThroughYmd?: string | null;
  /** Deterministic clock for paid-through vs expired (tests). */
  now?: Date;
  /** Override for today's YYYY-MM-DD (takes precedence over {@link now}). */
  todayYmd?: string;
};

type RememberedLegacyPaidThrough = {
  memberId: string;
  ymd: string | null;
};

let rememberedLegacyPaidThrough: RememberedLegacyPaidThrough | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function planIdFromConnection(conn: Record<string, unknown>): string {
  for (const key of ["planId", "plan", "id"] as const) {
    const value = conn[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** True when a Memberstack plan connection is currently entitled (not canceled/expired). */
export function isActiveMemberstackPlanConnection(conn: unknown): boolean {
  const record = asRecord(conn);
  if (record.active === false) return false;

  const status = String(record.status ?? "").trim().toUpperCase();
  if (!status) return true;
  return status === "ACTIVE" || status === "TRIALING";
}

/**
 * All ACTIVE plan ids from a Memberstack member payload (`getCurrentMember`,
 * `getAppAndMember`, or a bare member record). Canceled/expired connections are
 * excluded.
 */
export function getActivePlanIds(memberOrPayload: unknown): string[] {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return [];

  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member.planConnections ?? data.planConnections;
  if (!Array.isArray(connections)) return [];

  const ids: string[] = [];
  for (const conn of connections) {
    const record = asRecord(conn);
    if (!isActiveMemberstackPlanConnection(record)) continue;
    const planId = planIdFromConnection(record);
    if (planId) ids.push(planId);
  }
  return ids;
}

/** True when the payload represents a logged-in Memberstack member (has a member id). */
export function isMemberLoggedIn(memberOrPayload: unknown): boolean {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return false;
  const id = member.id ?? member._id;
  return typeof id === "string" ? Boolean(id.trim()) : Boolean(id);
}

/** Extract YYYY-MM-DD from a date-only value without shifting the calendar day. */
export function memberAccessYmdFromDateOnlyValue(
  value: string | Date | null | undefined,
): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const prefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (prefix) {
      return `${prefix[1]}-${prefix[2]}-${prefix[3]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  return null;
}

/** Today's calendar YYYY-MM-DD in the membership business timezone. */
export function memberAccessCalendarYmdForNow(
  now: Date = new Date(),
  timeZone: string = MEMBER_ACCESS_CALENDAR_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * True when the paid-through calendar day is today or in the future
 * (America/Los_Angeles). Missing/invalid dates are not valid.
 */
export function isLegacyPaidThroughCurrentlyValid(
  legacyPaidThroughYmd: string | null | undefined,
  options: Pick<MemberAccessOptions, "now" | "todayYmd"> = {},
): boolean {
  const expirationYmd = memberAccessYmdFromDateOnlyValue(legacyPaidThroughYmd ?? null);
  if (!expirationYmd) return false;
  const todayYmd =
    options.todayYmd ?? memberAccessCalendarYmdForNow(options.now ?? new Date());
  return expirationYmd >= todayYmd;
}

/** True when an ACTIVE paid membership plan (current or retired paid shell) is present. */
export function hasPaidMemberAccess(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => paidPlanIds.has(id));
}

/**
 * True when the free legacy membership plan is currently connected.
 * This is only a candidate for access ? {@link hasMemberAccess} still requires
 * a valid paid-through date.
 */
export function hasFreeLegacyPlanConnection(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => freeLegacyPlanIds.has(id));
}

/**
 * True when this payload can only gain access via the free legacy plan
 * (no paid plan). Callers should load the Watson paid-through date.
 */
export function needsLegacyPaidThroughForAccess(memberOrPayload: unknown): boolean {
  return (
    isMemberLoggedIn(memberOrPayload) &&
    !hasPaidMemberAccess(memberOrPayload) &&
    hasFreeLegacyPlanConnection(memberOrPayload)
  );
}

/**
 * Remember a Watson paid-through date for a Memberstack member id so sync
 * {@link hasMemberAccess} calls (Header, catalogs, CSS snapshot) use the same
 * determination after the client/server lookup.
 */
export function rememberLegacyPaidThroughForAccess(
  memberId: string,
  ymd: string | null,
): void {
  const id = memberId.trim();
  if (!id) return;
  rememberedLegacyPaidThrough = { memberId: id, ymd };
}

export function clearRememberedLegacyPaidThroughForAccess(): void {
  rememberedLegacyPaidThrough = null;
}

/** `undefined` = not loaded; `null` = loaded but no usable date. */
export function rememberedLegacyPaidThroughYmdForMember(
  memberId: string | null | undefined,
): string | null | undefined {
  if (!memberId || !rememberedLegacyPaidThrough) return undefined;
  if (rememberedLegacyPaidThrough.memberId !== memberId) return undefined;
  return rememberedLegacyPaidThrough.ymd;
}

function resolvedLegacyPaidThroughYmd(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): string | null | undefined {
  if (options && "legacyPaidThroughYmd" in options) {
    return options.legacyPaidThroughYmd;
  }
  const memberId =
    memberIdFromMemberstackPayload(memberOrPayload) ??
    (isMemberLoggedIn(memberOrPayload)
      ? String(
          memberRecordFromMemberstackPayload(memberOrPayload)?.id ??
            memberRecordFromMemberstackPayload(memberOrPayload)?._id ??
            "",
        ).trim() || undefined
      : undefined);
  return rememberedLegacyPaidThroughYmdForMember(memberId);
}

/**
 * The global member-access check. True only when the viewer is logged in AND
 * has a currently valid membership (paid plan, or free legacy plan with a
 * paid-through date that has not passed).
 */
export function hasMemberAccess(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): boolean {
  if (hasPaidMemberAccess(memberOrPayload)) return true;
  if (!hasFreeLegacyPlanConnection(memberOrPayload)) return false;
  return isLegacyPaidThroughCurrentlyValid(
    resolvedLegacyPaidThroughYmd(memberOrPayload, options) ?? null,
    options,
  );
}

/**
 * Resolved viewer state for a gated area:
 *   - `loggedOut`        ? prompt to log in
 *   - `loggedInNoAccess` ? prompt to become a member
 *   - `memberAccess`     ? unlock content
 */
export function getViewerAccessState(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): ViewerAccessState {
  if (!isMemberLoggedIn(memberOrPayload)) return "loggedOut";
  return hasMemberAccess(memberOrPayload, options) ? "memberAccess" : "loggedInNoAccess";
}

/**
 * Temporary: console debug for the global member gate (remove after verification).
 * Logs the member email, active plan ids found, whether access was granted, and
 * which gate/component made the decision.
 */
export function logMemberAccessDebug(
  gate: string,
  memberOrPayload: unknown,
  extra?: Record<string, unknown>,
): void {
  const activePlanIds = getActivePlanIds(memberOrPayload);
  console.log("[KIN member access]", {
    gate,
    memberEmail: memberEmailFromMemberstackPayload(memberOrPayload) ?? null,
    activePlanIds,
    paidPlanIds: [...PAID_MEMBER_ACCESS_PLAN_IDS],
    freeLegacyPlanIds: [...FREE_LEGACY_MEMBER_ACCESS_PLAN_IDS],
    hasPaidMemberAccess: hasPaidMemberAccess(memberOrPayload),
    hasFreeLegacyPlanConnection: hasFreeLegacyPlanConnection(memberOrPayload),
    legacyPaidThroughYmd: resolvedLegacyPaidThroughYmd(memberOrPayload) ?? null,
    hasMemberAccess: hasMemberAccess(memberOrPayload),
    viewerAccessState: getViewerAccessState(memberOrPayload),
    ...(extra ?? {}),
  });
}
