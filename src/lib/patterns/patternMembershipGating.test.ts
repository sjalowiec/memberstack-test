import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  canCreatePatternForSystem,
  canEditPatternSettingsForSystem,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import {
  canCopySavedCustomPatternForAccess,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
} from "./savedCustomPatternCopyAccess";
import {
  canStartNewSleevelessPattern,
  resolveNewPatternBlockedCopy,
} from "./sleevelessNewPatternAccessGuard";
import { resolveSaveLoggedOutCopy } from "./sleevelessPatternProjectCloudSave";
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
  freeClaimsBySystem: {},
};

const nosubSleevelessClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    sleeveless: { claimed: true, patternId: "pat_free" },
  },
};

const nosubDropShoulderClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    "drop-shoulder": { claimed: true, patternId: "pat_ds" },
  },
};

const betaMember: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_beta",
  hasSystemAccess: true,
  freeClaimsBySystem: {},
};

const paidMember: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimsBySystem: {},
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
    expect(canCreatePatternForSystem(LOGGED_OUT_SLEEVELESS_ACCESS, "sleeveless")).toBe(false);
    expect(canEditPatternSettingsForSystem(LOGGED_OUT_SLEEVELESS_ACCESS, "sleeveless")).toBe(false);
    expect(canStartNewSleevelessPattern(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(resolveNewPatternBlockedCopy(LOGGED_OUT_SLEEVELESS_ACCESS, "sleeveless")).toBe(
      resolveSaveLoggedOutCopy("sleeveless"),
    );
    expect(canCopySavedCustomPatternForAccess(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
  });

  it("logged-in no-plan users may start one pattern per system but not member-only actions", () => {
    expect(canCreatePatternForSystem(nosubUnclaimed, "sleeveless")).toBe(true);
    expect(canCreatePatternForSystem(nosubUnclaimed, "drop-shoulder")).toBe(true);
    expect(canEditPatternSettingsForSystem(nosubUnclaimed, "sleeveless")).toBe(true);
    expect(canStartNewSleevelessPattern(nosubUnclaimed)).toBe(true);
    expect(canCopySavedCustomPatternForAccess(nosubUnclaimed)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(nosubUnclaimed)).toBe(false);
  });

  it("sleeveless claim blocks only sleeveless, not drop-shoulder", () => {
    expect(canCreatePatternForSystem(nosubSleevelessClaimed, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(nosubSleevelessClaimed, "drop-shoulder")).toBe(true);
    expect(canEditPatternSettingsForSystem(nosubSleevelessClaimed, "sleeveless")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubSleevelessClaimed, "drop-shoulder")).toBe(true);
    expect(canStartNewSleevelessPattern(nosubSleevelessClaimed)).toBe(false);
    expect(canCopySavedCustomPatternForAccess(nosubSleevelessClaimed)).toBe(false);
  });

  it("drop-shoulder claim blocks only drop-shoulder, not sleeveless", () => {
    expect(canCreatePatternForSystem(nosubDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canCreatePatternForSystem(nosubDropShoulderClaimed, "sleeveless")).toBe(true);
    expect(canEditPatternSettingsForSystem(nosubDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubDropShoulderClaimed, "sleeveless")).toBe(true);
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(true);
  });

  it("active members and beta users get full access", () => {
    for (const access of [paidMember, betaMember]) {
      expect(canCreatePatternForSystem(access, "sleeveless")).toBe(true);
      expect(canCreatePatternForSystem(access, "drop-shoulder")).toBe(true);
      expect(canEditPatternSettingsForSystem(access, "sleeveless")).toBe(true);
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
      freeClaimsBySystem: {},
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
