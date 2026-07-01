import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  canCreateSleevelessPattern,
  canEditSleevelessPatternSettings,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import {
  canCopySavedCustomPatternForAccess,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
} from "./savedCustomPatternCopyAccess";
import {
  canStartNewSleevelessPattern,
  resolveSleevelessNewPatternBlockedCopy,
} from "./sleevelessNewPatternAccessGuard";
import {
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";
import { resolveHasAdvancedPatternAccessForAccess } from "./sleevelessPatternAccessGate";

vi.mock("../devBypass", () => ({ devBypass: false }));

import {
  invalidateSleevelessUserAccessCache,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

const nosubUnclaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimed: false,
};

const nosubClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_free",
};

const betaMember: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_beta",
  hasSystemAccess: true,
  freeClaimed: false,
};

const paidMember: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: false,
};

type MsMock = {
  getCurrentMember: ReturnType<typeof vi.fn>;
  getMemberJSON: ReturnType<typeof vi.fn>;
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

describe("pattern membership gating (pure rules)", () => {
  it("logged-out users are blocked from create, edit settings, and advanced access", () => {
    expect(canCreateSleevelessPattern(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(canEditSleevelessPatternSettings(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(canStartNewSleevelessPattern(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(resolveSleevelessNewPatternBlockedCopy(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(
      SLEEVELESS_SAVE_LOGGED_OUT_COPY,
    );
    expect(canCopySavedCustomPatternForAccess(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
  });

  it("logged-in no-plan users may start one pattern but not member-only actions", () => {
    expect(canCreateSleevelessPattern(nosubUnclaimed)).toBe(true);
    expect(canEditSleevelessPatternSettings(nosubUnclaimed)).toBe(true);
    expect(canStartNewSleevelessPattern(nosubUnclaimed)).toBe(true);
    expect(canCopySavedCustomPatternForAccess(nosubUnclaimed)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(nosubUnclaimed)).toBe(false);
  });

  it("logged-in no-plan users with a claimed free pattern are blocked from gated features", () => {
    expect(canCreateSleevelessPattern(nosubClaimed)).toBe(false);
    expect(canEditSleevelessPatternSettings(nosubClaimed)).toBe(false);
    expect(canStartNewSleevelessPattern(nosubClaimed)).toBe(false);
    expect(resolveSleevelessNewPatternBlockedCopy(nosubClaimed)).toBe(
      SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
    );
    expect(canCopySavedCustomPatternForAccess(nosubClaimed)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(nosubClaimed)).toBe(false);
  });

  it("active members and beta users get full access", () => {
    for (const access of [paidMember, betaMember]) {
      expect(canCreateSleevelessPattern(access)).toBe(true);
      expect(canEditSleevelessPatternSettings(access)).toBe(true);
      expect(canStartNewSleevelessPattern(access)).toBe(true);
      expect(canCopySavedCustomPatternForAccess(access)).toBe(true);
      expect(resolveHasAdvancedPatternAccessForAccess(access)).toBe(true);
    }
  });

  it("surfaces membership copy when copy is blocked", () => {
    expect(SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT).toMatch(/member/i);
  });
});

describe("pattern membership gating (Memberstack resolver)", () => {
  it("resolves nosub as logged-in without system access", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({
        data: {
          id: "ms_nosub",
          auth: { email: "nosub@knititnow.com" },
          planConnections: [],
        },
      }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });

    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      memberId: "ms_nosub",
      hasSystemAccess: false,
      freeClaimed: false,
    });
  });

  it("resolves beta plan users as members", async () => {
    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({
        data: {
          id: "ms_beta",
          auth: { email: "betatest@knititnow.com" },
          planConnections: [{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }],
        },
      }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });

    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: true,
      hasSystemAccess: true,
    });
  });
});

describe("pattern membership gating (devBypass does not override signed-in nosub)", () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it("uses real Memberstack entitlement when devBypass is active but nosub is logged in", async () => {
    vi.doMock("../devBypass", () => ({ devBypass: true }));
    const { resolveSleevelessUserAccess: resolveWithBypass } = await import(
      "./sleevelessPatternSystemAccessClient"
    );

    stubMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue({
        data: {
          id: "ms_nosub",
          auth: { email: "nosub@knititnow.com" },
          planConnections: [],
        },
      }),
      getMemberJSON: vi.fn().mockResolvedValue({ data: {} }),
    });

    await expect(resolveWithBypass()).resolves.toMatchObject({
      loggedIn: true,
      memberId: "ms_nosub",
      hasSystemAccess: false,
    });
  });
});
