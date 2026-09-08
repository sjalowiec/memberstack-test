import { afterEach, describe, expect, it, vi } from "vitest";
import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../config/memberships";
import {
  clearRememberedLegacyPaidThroughForAccess,
  hasMemberAccess,
  rememberedLegacyPaidThroughYmdForMember,
} from "./memberAccess";
import { ensureLegacyPaidThroughContext, MEMBER_ACCESS_API_PATH } from "./memberAccessClient";

const LEGACY_FREE = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;

function payload(planId: string, id = "mem_client") {
  return {
    data: {
      member: {
        id,
        auth: { email: "client@example.com" },
        planConnections: [{ planId, status: "ACTIVE", active: true }],
      },
    },
  };
}

afterEach(() => {
  clearRememberedLegacyPaidThroughForAccess();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ensureLegacyPaidThroughContext", () => {
  it("skips the network for paid members", async () => {
    const fetchPaidThroughYmd = vi.fn(async () => "2026-12-01");
    await ensureLegacyPaidThroughContext(payload(PAID), { fetchPaidThroughYmd });
    expect(fetchPaidThroughYmd).not.toHaveBeenCalled();
    expect(hasMemberAccess(payload(PAID))).toBe(true);
  });

  it("loads and remembers the date for free-legacy-only members", async () => {
    const fetchPaidThroughYmd = vi.fn(async () => "2026-12-01");
    const res = payload(LEGACY_FREE);
    expect(hasMemberAccess(res, { todayYmd: "2026-07-22" })).toBe(false);
    await ensureLegacyPaidThroughContext(res, { fetchPaidThroughYmd });
    expect(fetchPaidThroughYmd).toHaveBeenCalledTimes(1);
    expect(rememberedLegacyPaidThroughYmdForMember("mem_client")).toBe("2026-12-01");
    expect(hasMemberAccess(res, { todayYmd: "2026-07-22" })).toBe(true);
  });

  it("dedupes in-flight lookups for the same member", async () => {
    let resolveLoad: (value: string | null) => void = () => {};
    const fetchPaidThroughYmd = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const res = payload(LEGACY_FREE);
    const first = ensureLegacyPaidThroughContext(res, { fetchPaidThroughYmd });
    const second = ensureLegacyPaidThroughContext(res, { fetchPaidThroughYmd });
    resolveLoad("2026-12-01");
    await Promise.all([first, second]);
    expect(fetchPaidThroughYmd).toHaveBeenCalledTimes(1);
  });

  it("uses the member-access API path", () => {
    expect(MEMBER_ACCESS_API_PATH).toBe("/.netlify/functions/member-access");
  });
});
