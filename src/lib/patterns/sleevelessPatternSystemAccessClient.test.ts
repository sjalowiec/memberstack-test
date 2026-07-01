import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../devBypass", () => ({ devBypass: false }));
vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: vi.fn().mockResolvedValue(true),
}));
vi.mock("./patternEditGateDebug", () => ({
  logPatternEditGateDebug: vi.fn(),
}));

import {
  getCachedSleevelessUserAccess,
  invalidateSleevelessUserAccessCache,
  markFreeSleevelessPatternClaimed,
  planIdsFromMemberstackPayload,
  resetFreeSleevelessPatternClaimForCurrentMember,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS } from "./sleevelessPatternSystemAccess";

type MsMock = {
  getCurrentMember: ReturnType<typeof vi.fn>;
  getMemberJSON: ReturnType<typeof vi.fn>;
  updateMemberJSON: ReturnType<typeof vi.fn>;
};

function stubMemberstack(ms: Partial<MsMock>): void {
  vi.stubGlobal("window", { ...globalThis.window, $memberstackDom: ms });
}

beforeEach(() => {
  invalidateSleevelessUserAccessCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateSleevelessUserAccessCache();
});

describe("planIdsFromMemberstackPayload", () => {
  it("extracts plan ids from nested payloads", () => {
    expect(
      planIdsFromMemberstackPayload({
        data: { id: "ms_1", planConnections: [{ planId: "pln_a" }, { planId: "pln_b" }] },
      }),
    ).toEqual(["pln_a", "pln_b"]);
  });

  it("returns an empty array when there are no plans", () => {
    expect(planIdsFromMemberstackPayload({ data: { id: "ms_1" } })).toEqual([]);
    expect(planIdsFromMemberstackPayload(null)).toEqual([]);
  });
});

describe("resolveSleevelessUserAccess", () => {
  it("reports logged-out when Memberstack has no member", async () => {
    stubMemberstack({ getCurrentMember: vi.fn().mockResolvedValue({ data: null }) });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: false,
      hasSystemAccess: false,
      freeClaimsBySystem: {},
    });
  });

  it("reports a free, unclaimed user", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free", planConnections: [] } }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      memberId: "ms_free",
      hasSystemAccess: false,
      freeClaimsBySystem: {},
    });
  });

  it("reports a free user who already claimed their pattern (legacy keys migrated)", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free", planConnections: [] } }),
      getMemberJSON: vi.fn().mockResolvedValue({
        data: { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "pat_1" },
      }),
    });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      hasSystemAccess: false,
      freeClaimsBySystem: {
        sleeveless: { claimed: true, patternId: "pat_1" },
      },
    });
  });

  it("grants system access for a paid membership plan", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({
        data: {
          id: "ms_member",
          planConnections: [{ planId: SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS[0] }],
        },
      }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      hasSystemAccess: true,
    });
  });

  it("grants system access via the member-JSON unlock flag", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_unlock", planConnections: [] } }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: { sleevelessPatternSystemUnlocked: true } }),
    });
    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      hasSystemAccess: true,
    });
  });
});

describe("markFreeSleevelessPatternClaimed", () => {
  it("writes a merged claim to member JSON and updates the cache", async () => {
    const updateMemberJSON = vi.fn().mockResolvedValue({ data: { json: {} } });
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free", planConnections: [] } }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: { existingKey: "keep" } }),
      updateMemberJSON,
    });

    await resolveSleevelessUserAccess();
    const ok = await markFreeSleevelessPatternClaimed("pat_new");

    expect(ok).toBe(true);
    expect(updateMemberJSON).toHaveBeenCalledWith({
      json: expect.objectContaining({
        existingKey: "keep",
        freeSleevelessPatternClaimed: true,
        freeSleevelessPatternId: "pat_new",
        freePatternClaimsBySystem: {
          sleeveless: { claimed: true, patternId: "pat_new" },
        },
      }),
    });
    expect(getCachedSleevelessUserAccess()).toMatchObject({
      freeClaimsBySystem: {
        sleeveless: { claimed: true, patternId: "pat_new" },
      },
    });
  });

  it("returns false when member JSON APIs are unavailable", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free" } }),
    });
    await expect(markFreeSleevelessPatternClaimed("pat_x")).resolves.toBe(false);
  });
});

describe("resetFreeSleevelessPatternClaimForCurrentMember", () => {
  it("clears all claims, preserves unrelated keys, and invalidates the cache", async () => {
    const updateMemberJSON = vi.fn().mockResolvedValue({ data: { json: {} } });
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free", planConnections: [] } }),
      getMemberJSON: vi.fn().mockResolvedValue({
        data: {
          preferences: { theme: "dark" },
          freeSleevelessPatternClaimed: true,
          freeSleevelessPatternId: "pat_old",
        },
      }),
      updateMemberJSON,
    });

    await resolveSleevelessUserAccess();
    expect(getCachedSleevelessUserAccess()).not.toBeNull();

    const result = await resetFreeSleevelessPatternClaimForCurrentMember();

    expect(result).toEqual({ ok: true, memberId: "ms_free" });
    expect(updateMemberJSON).toHaveBeenCalledWith({
      json: expect.objectContaining({
        preferences: { theme: "dark" },
        freeSleevelessPatternClaimed: false,
        freeSleevelessPatternId: null,
        freePatternClaimsBySystem: {},
      }),
    });
    expect(getCachedSleevelessUserAccess()).toBeNull();
  });

  it("returns a failure when member JSON APIs are unavailable", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_free" } }),
    });
    await expect(resetFreeSleevelessPatternClaimForCurrentMember()).resolves.toMatchObject({
      ok: false,
      reason: "memberstack-json-unavailable",
    });
  });

  it("returns a failure when no member is logged in", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({ data: null }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
      updateMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });
    await expect(resetFreeSleevelessPatternClaimForCurrentMember()).resolves.toMatchObject({
      ok: false,
      reason: "no-member-id",
    });
  });
});
