/**
 * Browser helper: load Watson paid-through for logged-in members without an
 * active paid plan so sync {@link hasMemberAccess} calls share one determination.
 *
 * Paid members skip the network. Fail closed when the lookup is unavailable.
 */
import {
  clearRememberedComplimentaryThroughForAccess,
  clearRememberedLegacyPaidThroughForAccess,
  hasComplimentaryMemberAccess,
  hasPaidMemberAccess,
  isMemberLoggedIn,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  rememberComplimentaryThroughForAccess,
  rememberLegacyPaidThroughForAccess,
  rememberedComplimentaryThroughYmdForMember,
  rememberedLegacyPaidThroughYmdForMember,
} from "./memberAccess";
import { getMembershipStatusAuthHeaders } from "./membership/membershipStatusClient";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

export const MEMBER_ACCESS_API_PATH = "/.netlify/functions/member-access";

const inFlightByMemberId = new Map<string, Promise<void>>();

function memberIdForAccessContext(memberOrPayload: unknown): string | undefined {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const nested = member?.id ?? member?._id;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return memberIdFromMemberstackPayload(memberOrPayload);
}

type MemberAccessApiBody = {
  ok?: boolean;
  legacyPaidThroughYmd?: string | null;
  complimentaryThroughYmd?: string | null;
};

export type MemberAccessDateContext = {
  legacyPaidThroughYmd: string | null;
  complimentaryThroughYmd: string | null;
};

async function fetchMemberAccessDatesFromApi(): Promise<MemberAccessDateContext | null> {
  if (typeof window === "undefined") return null;
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) return null;

  const res = await fetch(MEMBER_ACCESS_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) return null;

  let body: MemberAccessApiBody | null = null;
  try {
    body = (await res.json()) as MemberAccessApiBody;
  } catch {
    return null;
  }
  if (!body || body.ok === false) return null;
  return {
    legacyPaidThroughYmd: memberAccessYmdFromDateOnlyValue(body.legacyPaidThroughYmd ?? null),
    complimentaryThroughYmd: memberAccessYmdFromDateOnlyValue(body.complimentaryThroughYmd ?? null),
  };
}

export type EnsureLegacyPaidThroughContextDeps = {
  /** Legacy-only test hook. Complimentary date stays unloaded when this is used alone. */
  fetchPaidThroughYmd?: () => Promise<string | null>;
  fetchAccessDates?: () => Promise<MemberAccessDateContext | null>;
};

/**
 * Load and remember the Watson paid-through date when the visitor has no
 * active paid plan. No-op for paid members, logged-out visitors, and users
 * who already have a remembered date. The free legacy plan is not required.
 */
export async function ensureLegacyPaidThroughContext(
  memberOrPayload: unknown,
  deps: EnsureLegacyPaidThroughContextDeps = {},
): Promise<void> {
  if (!isMemberLoggedIn(memberOrPayload)) {
    clearRememberedLegacyPaidThroughForAccess();
    clearRememberedComplimentaryThroughForAccess();
    return;
  }
  if (hasPaidMemberAccess(memberOrPayload)) return;

  const needsComplimentary = hasComplimentaryMemberAccess(memberOrPayload);
  const needsLegacy = needsLegacyPaidThroughForAccess(memberOrPayload);
  if (!needsComplimentary && !needsLegacy) return;

  const memberId = memberIdForAccessContext(memberOrPayload);
  if (!memberId) return;

  const legacyKnown = rememberedLegacyPaidThroughYmdForMember(memberId) !== undefined;
  const complimentaryKnown =
    rememberedComplimentaryThroughYmdForMember(memberId) !== undefined;
  if ((!needsLegacy || legacyKnown) && (!needsComplimentary || complimentaryKnown)) return;

  const existing = inFlightByMemberId.get(memberId);
  if (existing) {
    await existing;
    return;
  }

  const work = (async () => {
    try {
      if (deps.fetchPaidThroughYmd && !deps.fetchAccessDates) {
        const ymd = await deps.fetchPaidThroughYmd();
        rememberLegacyPaidThroughForAccess(memberId, ymd);
        return;
      }
      const load = deps.fetchAccessDates ?? fetchMemberAccessDatesFromApi;
      const dates = await load();
      if (!dates) {
        if (needsLegacy) rememberLegacyPaidThroughForAccess(memberId, null);
        return;
      }
      rememberLegacyPaidThroughForAccess(memberId, dates.legacyPaidThroughYmd);
      if (needsComplimentary) {
        rememberComplimentaryThroughForAccess(memberId, dates.complimentaryThroughYmd);
      }
    } catch {
      if (needsLegacy) rememberLegacyPaidThroughForAccess(memberId, null);
    } finally {
      inFlightByMemberId.delete(memberId);
    }
  })();

  inFlightByMemberId.set(memberId, work);
  await work;
}
