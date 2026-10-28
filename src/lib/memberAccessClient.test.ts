import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPLIMENTARY_MEMBER_PLAN_IDS,
  FREE_ACCESS_MEMBERSHIPS,
  MEMBERSHIPS,
} from "../config/memberships";
import {
  clearRememberedLegacyPaidThroughForAccess,
  clearRememberedServerConfirmedPaidAccess,
  hasMemberAccess,
  rememberedLegacyPaidThroughYmdForMember,
  rememberedServerConfirmedPaidBillingInterval,
} from "./memberAccess";
import { resolveAccountMembershipPanelView } from "./membership/accountMembershipPanel";
import {
  clearVerifiedMemberAccessCache,
  ensureLegacyPaidThroughContext,
  MEMBER_ACCESS_API_PATH,
  MEMBER_ACCESS_CACHE_KEY,
  MEMBER_ACCESS_FRESH_MS,
  readFreshVerifiedMemberAccess,
  resolveVerifiedMemberAccess,
} from "./memberAccessClient";

const LEGACY_FREE = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const COMPLIMENTARY_PLAN = COMPLIMENTARY_MEMBER_PLAN_IDS[0];

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
  clearRememberedServerConfirmedPaidAccess();
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

  it("loads and remembers the date for logged-in members without a paid plan", async () => {
    const fetchPaidThroughYmd = vi.fn(async () => "2026-12-01");
    const res = payload(LEGACY_FREE);
    expect(hasMemberAccess(res, { todayYmd: "2026-07-22" })).toBe(false);
    await ensureLegacyPaidThroughContext(res, { fetchPaidThroughYmd });
    expect(fetchPaidThroughYmd).toHaveBeenCalledTimes(1);
    expect(rememberedLegacyPaidThroughYmdForMember("mem_client")).toBe("2026-12-01");
    expect(hasMemberAccess(res, { todayYmd: "2026-07-22" })).toBe(true);
  });

  it("loads Watson for a logged-in member with no free legacy plan", async () => {
    const fetchPaidThroughYmd = vi.fn(async () => "2026-10-07");
    const res = {
      data: {
        member: {
          id: "mem_migrated",
          auth: { email: "client@example.com" },
          planConnections: [],
        },
      },
    };
    expect(hasMemberAccess(res, { todayYmd: "2026-07-22" })).toBe(false);
    await ensureLegacyPaidThroughContext(res, { fetchPaidThroughYmd });
    expect(fetchPaidThroughYmd).toHaveBeenCalledTimes(1);
    expect(rememberedLegacyPaidThroughYmdForMember("mem_migrated")).toBe("2026-10-07");
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

  it("uses a server-confirmed annual plan when the browser payload only has the free legacy plan", async () => {
    const res = payload(LEGACY_FREE);
    const status = await ensureLegacyPaidThroughContext(res, {
      fetchAccessDates: async () => ({
        legacyPaidThroughYmd: null,
        legacyPaidThroughLookup: "not_loaded",
        complimentaryThroughYmd: null,
        serverConfirmedPaidAccess: true,
        serverConfirmedPaidBillingInterval: "annual",
      }),
    });
    expect(status).toBe("ready");
    expect(rememberedLegacyPaidThroughYmdForMember("mem_client")).toBeUndefined();
    expect(rememberedServerConfirmedPaidBillingInterval("mem_client")).toBe("annual");
    expect(hasMemberAccess(res, { todayYmd: "2026-10-28" })).toBe(true);
    expect(resolveAccountMembershipPanelView(res, { todayYmd: "2026-10-28" })).toMatchObject({
      planDisplayLabel: "Annual Membership",
      statusLabel: "Active",
      visibleActions: ["manageBilling"],
      renewsLabel: null,
      membershipDateLabel: null,
    });
  });

  it("shows the Stripe renewal date and does not use the Watson date", async () => {
    const res = payload(LEGACY_FREE);
    await ensureLegacyPaidThroughContext(res, {
      fetchAccessDates: async () => ({
        legacyPaidThroughYmd: "2026-01-15",
        legacyPaidThroughLookup: "found",
        complimentaryThroughYmd: null,
        serverConfirmedPaidAccess: true,
        serverConfirmedPaidBillingInterval: "annual",
        serverConfirmedPaidRenewsLabel: "November 30, 2027",
      }),
    });
    expect(resolveAccountMembershipPanelView(res, { todayYmd: "2026-10-28" })).toMatchObject({
      planDisplayLabel: "Annual Membership",
      statusLabel: "Active",
      visibleActions: ["manageBilling"],
      renewsLabel: "November 30, 2027",
      membershipDateLabel: null,
    });
  });

  it("remembers a completed Watson miss as not found", async () => {
    const res = payload(LEGACY_FREE);
    await ensureLegacyPaidThroughContext(res, {
      fetchAccessDates: async () => ({
        legacyPaidThroughYmd: null,
        legacyPaidThroughLookup: "not_found",
        complimentaryThroughYmd: null,
        serverConfirmedPaidAccess: false,
        serverConfirmedPaidBillingInterval: null,
      }),
    });
    expect(rememberedLegacyPaidThroughYmdForMember("mem_client")).toBeNull();
    expect(hasMemberAccess(res, { todayYmd: "2026-10-28" })).toBe(false);
  });

  it("leaves the Watson date unloaded when the access request fails", async () => {
    const res = payload(LEGACY_FREE);
    const status = await ensureLegacyPaidThroughContext(res, {
      fetchAccessDates: async () => null,
    });
    expect(status).toBe("unavailable");
    expect(rememberedLegacyPaidThroughYmdForMember("mem_client")).toBeUndefined();
    expect(hasMemberAccess(res, { todayYmd: "2026-10-28" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Failure handling, cross-page reuse, and shared verification
// ---------------------------------------------------------------------------

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  };
}

type Handler = (...args: unknown[]) => void;

function stubBrowser(options: {
  memberId?: string | null;
  getAppAndMember?: () => Promise<unknown>;
  getCurrentMember?: () => Promise<unknown>;
  noMemberstack?: boolean;
} = {}) {
  const session = memoryStorage();
  const local = memoryStorage();
  const handlers: Record<string, Handler[]> = {};
  const cookie = options.memberId ? `_ms_mid=${options.memberId}` : "";
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("document", { cookie });
  const ms = options.noMemberstack
    ? undefined
    : {
        getAppAndMember: options.getAppAndMember,
        getCurrentMember: options.getCurrentMember ?? (async () => ({ data: null })),
        getMemberCookie: () => "test-jwt",
        onReady: Promise.resolve(),
        on: (event: string, handler: Handler) => {
          (handlers[event] ??= []).push(handler);
        },
      };
  vi.stubGlobal("window", { $memberstackDom: ms });
  return {
    session,
    emit: (event: string) => handlers[event]?.forEach((h) => h()),
  };
}

function legacyOnly(id = "mem_legacy") {
  return {
    data: {
      member: { id, auth: { email: "legacy@example.com" }, planConnections: [] },
    },
  };
}

const FUTURE = "2099-12-31";

describe("ensureLegacyPaidThroughContext failures", () => {
  afterEach(() => {
    clearVerifiedMemberAccessCache();
  });

  it("reports unavailable and does not record a confirmed missing date", async () => {
    stubBrowser();
    const res = legacyOnly();
    const status = await ensureLegacyPaidThroughContext(res, {
      fetchAccessDates: async () => null,
    });
    expect(status).toBe("unavailable");
    expect(rememberedLegacyPaidThroughYmdForMember("mem_legacy")).toBeUndefined();
    // Sync checks still fail closed while the date is unknown.
    expect(hasMemberAccess(res)).toBe(false);
  });

  it("retries after a failure and grants once the lookup succeeds", async () => {
    stubBrowser();
    const res = legacyOnly();
    const fetchAccessDates = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ legacyPaidThroughYmd: FUTURE, complimentaryThroughYmd: null });
    expect(await ensureLegacyPaidThroughContext(res, { fetchAccessDates })).toBe("unavailable");
    expect(await ensureLegacyPaidThroughContext(res, { fetchAccessDates })).toBe("ready");
    expect(fetchAccessDates).toHaveBeenCalledTimes(2);
    expect(hasMemberAccess(res)).toBe(true);
  });

  it("reuses a fresh cached date on the next page instead of refetching", async () => {
    stubBrowser({ memberId: "mem_legacy" });
    const res = legacyOnly();
    const fetchAccessDates = vi.fn(async () => ({
      legacyPaidThroughYmd: FUTURE,
      complimentaryThroughYmd: null,
    }));
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    // Simulate a new page load: in-memory state is gone, sessionStorage remains.
    clearRememberedLegacyPaidThroughForAccess();
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    expect(fetchAccessDates).toHaveBeenCalledTimes(1);
    expect(hasMemberAccess(res)).toBe(true);
  });

  it("keeps Annual Membership and the Stripe date in a cached session", async () => {
    stubBrowser({ memberId: "mem_client" });
    const res = payload(LEGACY_FREE);
    const fetchAccessDates = vi.fn(async () => ({
      legacyPaidThroughYmd: "2026-01-15",
      legacyPaidThroughLookup: "found" as const,
      complimentaryThroughYmd: null,
      serverConfirmedPaidAccess: true,
      serverConfirmedPaidBillingInterval: "annual" as const,
      serverConfirmedPaidRenewsLabel: "November 30, 2027",
    }));
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    clearRememberedLegacyPaidThroughForAccess();
    clearRememberedServerConfirmedPaidAccess();
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    expect(fetchAccessDates).toHaveBeenCalledTimes(1);
    expect(resolveAccountMembershipPanelView(res, { todayYmd: "2026-10-28" })).toMatchObject({
      planDisplayLabel: "Annual Membership",
      statusLabel: "Active",
      visibleActions: ["manageBilling"],
      renewsLabel: "November 30, 2027",
      membershipDateLabel: null,
    });
  });

  it("keeps Paid through for a cached legacy-only session", async () => {
    stubBrowser({ memberId: "mem_client" });
    const res = payload(LEGACY_FREE);
    const fetchAccessDates = vi.fn(async () => ({
      legacyPaidThroughYmd: "2027-11-30",
      legacyPaidThroughLookup: "found" as const,
      complimentaryThroughYmd: null,
      serverConfirmedPaidAccess: false,
      serverConfirmedPaidBillingInterval: null,
      serverConfirmedPaidRenewsLabel: null,
    }));
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    clearRememberedLegacyPaidThroughForAccess();
    clearRememberedServerConfirmedPaidAccess();
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    expect(fetchAccessDates).toHaveBeenCalledTimes(1);
    expect(resolveAccountMembershipPanelView(res, { todayYmd: "2026-10-28" })).toMatchObject({
      planDisplayLabel: "Legacy Membership",
      statusLabel: "Legacy Access",
      visibleActions: ["renewAnnual", "becomeMonthly"],
      renewsLabel: null,
      membershipDateLabel: "Paid through",
      membershipDateValue: "November 30, 2027",
    });
  });

  it("refetches once the cached date is older than the freshness window", async () => {
    const { session } = stubBrowser({ memberId: "mem_legacy" });
    const res = legacyOnly();
    const fetchAccessDates = vi.fn(async () => ({
      legacyPaidThroughYmd: FUTURE,
      complimentaryThroughYmd: null,
    }));
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    const entry = JSON.parse(session.getItem(MEMBER_ACCESS_CACHE_KEY)!);
    entry.verifiedAt = Date.now() - MEMBER_ACCESS_FRESH_MS - 1000;
    session.setItem(MEMBER_ACCESS_CACHE_KEY, JSON.stringify(entry));
    clearRememberedLegacyPaidThroughForAccess();
    await ensureLegacyPaidThroughContext(res, { fetchAccessDates });
    expect(fetchAccessDates).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a different member's cached date (account switch)", async () => {
    stubBrowser({ memberId: "mem_b" });
    const fetchAccessDates = vi.fn(async () => ({
      legacyPaidThroughYmd: FUTURE,
      complimentaryThroughYmd: null,
    }));
    await ensureLegacyPaidThroughContext(legacyOnly("mem_a"), { fetchAccessDates });
    clearRememberedLegacyPaidThroughForAccess();
    await ensureLegacyPaidThroughContext(legacyOnly("mem_b"), { fetchAccessDates });
    expect(fetchAccessDates).toHaveBeenCalledTimes(2);
  });
});

describe("resolveVerifiedMemberAccess", () => {
  afterEach(() => {
    clearVerifiedMemberAccessCache();
  });

  const fast = { memberstackDeadlineMs: 300, pollIntervalMs: 10 };

  it("waits past a plan-less payload so an active member is not misread", async () => {
    const getAppAndMember = vi
      .fn()
      .mockResolvedValueOnce({ data: { member: { id: "mem_paid" } } })
      .mockResolvedValue(payload(PAID, "mem_paid"));
    stubBrowser({ memberId: "mem_paid", getAppAndMember });
    const ensureContext = vi.fn(async () => "ready" as const);
    const result = await resolveVerifiedMemberAccess({ ...fast, ensureContext });
    expect(result).toMatchObject({ status: "verified", viewer: "memberAccess" });
    expect(getAppAndMember.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shares one in-flight check between concurrent consumers", async () => {
    const getAppAndMember = vi.fn(async () => payload(PAID, "mem_paid"));
    stubBrowser({ memberId: "mem_paid", getAppAndMember });
    const [a, b, c] = await Promise.all([
      resolveVerifiedMemberAccess(fast),
      resolveVerifiedMemberAccess(fast),
      resolveVerifiedMemberAccess(fast),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(getAppAndMember).toHaveBeenCalledTimes(1);
  });

  it("reports logged-out visitors as verified loggedOut", async () => {
    stubBrowser({ getAppAndMember: async () => ({ data: { app: {}, member: null } }) });
    await expect(resolveVerifiedMemberAccess(fast)).resolves.toMatchObject({
      status: "verified",
      viewer: "loggedOut",
    });
  });

  it("reports an error (not logged out) when Memberstack never loads", async () => {
    stubBrowser({ noMemberstack: true });
    await expect(resolveVerifiedMemberAccess(fast)).resolves.toMatchObject({
      status: "error",
      reason: "memberstack-unavailable",
    });
  });

  it("reports an error (not a non-member) when the Watson lookup fails", async () => {
    stubBrowser({ memberId: "mem_legacy", getAppAndMember: async () => legacyOnly() });
    const result = await resolveVerifiedMemberAccess({
      ...fast,
      ensureContext: async () => "unavailable",
    });
    expect(result).toMatchObject({ status: "error", reason: "access-lookup-unavailable" });
  });

  it("does not cache errors, so Retry runs a new check", async () => {
    const ensureContext = vi
      .fn()
      .mockResolvedValueOnce("unavailable")
      .mockResolvedValueOnce("ready");
    stubBrowser({ memberId: "mem_paid", getAppAndMember: async () => payload(PAID, "mem_paid") });
    expect((await resolveVerifiedMemberAccess({ ...fast, ensureContext })).status).toBe("error");
    expect((await resolveVerifiedMemberAccess({ ...fast, ensureContext })).status).toBe("verified");
  });

  it("remembers a verified member for the same Memberstack id only", async () => {
    stubBrowser({ memberId: "mem_paid", getAppAndMember: async () => payload(PAID, "mem_paid") });
    await resolveVerifiedMemberAccess(fast);
    expect(readFreshVerifiedMemberAccess()).toMatchObject({
      memberId: "mem_paid",
      viewer: "memberAccess",
    });
    vi.stubGlobal("document", { cookie: "_ms_mid=mem_other" });
    expect(readFreshVerifiedMemberAccess()).toBeNull();
    vi.stubGlobal("document", { cookie: "" });
    expect(readFreshVerifiedMemberAccess()).toBeNull();
  });

  it("clears verified state on Memberstack logout", async () => {
    const browser = stubBrowser({
      memberId: "mem_paid",
      getAppAndMember: async () => payload(PAID, "mem_paid"),
    });
    await resolveVerifiedMemberAccess(fast);
    expect(browser.session.getItem(MEMBER_ACCESS_CACHE_KEY)).not.toBeNull();
    browser.emit("member.logout");
    expect(browser.session.getItem(MEMBER_ACCESS_CACHE_KEY)).toBeNull();
  });

  it("verifies a complimentary member with no saved date as a member", async () => {
    stubBrowser({
      memberId: "mem_comp",
      getAppAndMember: async () => payload(COMPLIMENTARY_PLAN, "mem_comp"),
    });
    const ensureContext = vi.fn(async () => "ready" as const);
    await expect(resolveVerifiedMemberAccess({ ...fast, ensureContext })).resolves.toMatchObject({
      status: "verified",
      viewer: "memberAccess",
    });
  });
});

describe("resolveVerifiedMemberAccess while the session restores", () => {
  afterEach(() => {
    clearVerifiedMemberAccessCache();
  });

  const fast = { memberstackDeadlineMs: 300, pollIntervalMs: 10 };

  function stubRestoringSession(onReady: Promise<void>, read: () => Promise<unknown>) {
    stubBrowser({ getAppAndMember: read });
    (window.$memberstackDom as { onReady?: Promise<void> }).onReady = onReady;
  }

  it("does not report signed out while onReady has not settled", async () => {
    stubRestoringSession(new Promise<void>(() => {}), async () => ({ data: null }));
    await expect(resolveVerifiedMemberAccess(fast)).resolves.toMatchObject({
      status: "error",
      reason: "memberstack-unavailable",
    });
  });

  it("reports signed out once onReady settles with no member", async () => {
    let settle: () => void = () => {};
    const onReady = new Promise<void>((resolve) => {
      settle = resolve;
    });
    stubRestoringSession(onReady, async () => ({ data: { app: {}, member: null } }));
    const pending = resolveVerifiedMemberAccess(fast);
    setTimeout(() => settle(), 30);
    await expect(pending).resolves.toMatchObject({ status: "verified", viewer: "loggedOut" });
  });

  it("recognizes a restored member that appears before onReady settles", async () => {
    let calls = 0;
    stubRestoringSession(new Promise<void>(() => {}), async () => {
      calls += 1;
      return calls === 1 ? { data: null } : payload(PAID, "mem_restored");
    });
    await expect(resolveVerifiedMemberAccess(fast)).resolves.toMatchObject({
      status: "verified",
      viewer: "memberAccess",
    });
  });
});
describe("cached access never outlives a known access-through day", () => {
  // 23:55 and 00:01 America/Los_Angeles (PDT, UTC-7): six minutes apart,
  // inside the freshness window, but on different calendar days.
  const BEFORE_MIDNIGHT = new Date("2026-10-25T06:55:00Z"); // Oct 24, 23:55 LA
  const AFTER_MIDNIGHT = new Date("2026-10-25T07:01:00Z"); // Oct 25, 00:01 LA
  const LAST_DAY = "2026-10-24";
  const fast = { memberstackDeadlineMs: 300, pollIntervalMs: 10 };

  afterEach(() => {
    vi.useRealTimers();
    clearVerifiedMemberAccessCache();
  });

  it("drops a cached legacy member after the paid-through day ends", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_MIDNIGHT);
    stubBrowser({ memberId: "mem_legacy", getAppAndMember: async () => legacyOnly() });
    const ensureContext = vi.fn(async (res: unknown) =>
      ensureLegacyPaidThroughContext(res, {
        fetchAccessDates: async () => ({
          legacyPaidThroughYmd: LAST_DAY,
          complimentaryThroughYmd: null,
        }),
      }),
    );
    await expect(resolveVerifiedMemberAccess({ ...fast, ensureContext })).resolves.toMatchObject({
      viewer: "memberAccess",
    });
    expect(readFreshVerifiedMemberAccess()).toMatchObject({
      viewer: "memberAccess",
      accessThroughYmd: LAST_DAY,
    });

    vi.setSystemTime(AFTER_MIDNIGHT);
    expect(readFreshVerifiedMemberAccess()).toBeNull();

    // The background re-check reuses the cached date (no refetch) and denies.
    clearRememberedLegacyPaidThroughForAccess();
    const fetchAccessDates = vi.fn();
    const recheck = await resolveVerifiedMemberAccess({
      ...fast,
      force: true,
      ensureContext: (res) => ensureLegacyPaidThroughContext(res, { fetchAccessDates }),
    });
    expect(fetchAccessDates).not.toHaveBeenCalled();
    expect(recheck).toMatchObject({ status: "verified", viewer: "loggedInNoAccess" });
  });

  it("drops a cached complimentary member after the access-through day ends", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_MIDNIGHT);
    const comp = payload(COMPLIMENTARY_PLAN, "mem_comp");
    stubBrowser({ memberId: "mem_comp", getAppAndMember: async () => comp });
    const ensureContext = vi.fn(async (res: unknown) =>
      ensureLegacyPaidThroughContext(res, {
        fetchAccessDates: async () => ({
          legacyPaidThroughYmd: null,
          complimentaryThroughYmd: LAST_DAY,
        }),
      }),
    );
    await resolveVerifiedMemberAccess({ ...fast, ensureContext });
    expect(readFreshVerifiedMemberAccess()).toMatchObject({ accessThroughYmd: LAST_DAY });

    vi.setSystemTime(AFTER_MIDNIGHT);
    expect(readFreshVerifiedMemberAccess()).toBeNull();
  });

  it("keeps the later date when complimentary and legacy both grant", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_MIDNIGHT);
    const comp = payload(COMPLIMENTARY_PLAN, "mem_both");
    stubBrowser({ memberId: "mem_both", getAppAndMember: async () => comp });
    await resolveVerifiedMemberAccess({
      ...fast,
      ensureContext: (res) =>
        ensureLegacyPaidThroughContext(res, {
          fetchAccessDates: async () => ({
            legacyPaidThroughYmd: "2026-12-31",
            complimentaryThroughYmd: LAST_DAY,
          }),
        }),
    });
    vi.setSystemTime(AFTER_MIDNIGHT);
    expect(readFreshVerifiedMemberAccess()).toMatchObject({
      viewer: "memberAccess",
      accessThroughYmd: "2026-12-31",
    });
  });

  it("does not date-bound a paid member", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_MIDNIGHT);
    stubBrowser({ memberId: "mem_paid", getAppAndMember: async () => payload(PAID, "mem_paid") });
    await resolveVerifiedMemberAccess(fast);
    vi.setSystemTime(AFTER_MIDNIGHT);
    expect(readFreshVerifiedMemberAccess()).toMatchObject({
      viewer: "memberAccess",
      accessThroughYmd: null,
    });
  });
});
