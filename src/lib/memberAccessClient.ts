/**
 * Browser helper: load Watson paid-through for free-legacy-only members so
 * sync {@link hasMemberAccess} calls share one determination.
 *
 * Paid members skip the network. Fail closed when the lookup is unavailable.
 */
import {
  clearRememberedLegacyPaidThroughForAccess,
  isMemberLoggedIn,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  rememberLegacyPaidThroughForAccess,
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
};

async function fetchLegacyPaidThroughYmdFromApi(): Promise<string | null> {
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
  return memberAccessYmdFromDateOnlyValue(body.legacyPaidThroughYmd ?? null);
}

export type EnsureLegacyPaidThroughContextDeps = {
  fetchPaidThroughYmd?: () => Promise<string | null>;
};

/**
 * Load and remember the Watson paid-through date when the visitor's only
 * qualifying plan is the free legacy membership. No-op for paid members,
 * logged-out visitors, and users who already have a remembered date.
 */
export async function ensureLegacyPaidThroughContext(
  memberOrPayload: unknown,
  deps: EnsureLegacyPaidThroughContextDeps = {},
): Promise<void> {
  if (!isMemberLoggedIn(memberOrPayload)) {
    clearRememberedLegacyPaidThroughForAccess();
    return;
  }
  if (!needsLegacyPaidThroughForAccess(memberOrPayload)) return;

  const memberId = memberIdForAccessContext(memberOrPayload);
  if (!memberId) return;
  if (rememberedLegacyPaidThroughYmdForMember(memberId) !== undefined) return;

  const existing = inFlightByMemberId.get(memberId);
  if (existing) {
    await existing;
    return;
  }

  const work = (async () => {
    try {
      const load = deps.fetchPaidThroughYmd ?? fetchLegacyPaidThroughYmdFromApi;
      const ymd = await load();
      rememberLegacyPaidThroughForAccess(memberId, ymd);
    } catch {
      rememberLegacyPaidThroughForAccess(memberId, null);
    } finally {
      inFlightByMemberId.delete(memberId);
    }
  })();

  inFlightByMemberId.set(memberId, work);
  await work;
}
