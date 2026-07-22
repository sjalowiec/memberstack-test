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
vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: vi.fn().mockResolvedValue(true),
  waitForMemberstackReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./patternEditGateDebug", () => ({
  logPatternEditGateDebug: vi.fn(),
}));

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

  it("logged-in no-plan users cannot create or edit patterns (membership required)", () => {
    expect(canCreatePatternForSystem(nosubUnclaimed, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(nosubUnclaimed, "drop-shoulder")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubUnclaimed, "sleeveless")).toBe(false);
    expect(canStartNewSleevelessPattern(nosubUnclaimed)).toBe(false);
    expect(canCopySavedCustomPatternForAccess(nosubUnclaimed)).toBe(false);
    expect(resolveHasAdvancedPatternAccessForAccess(nosubUnclaimed)).toBe(false);
  });

  it("historical free claims never grant create/edit without active entitlement", () => {
    expect(canCreatePatternForSystem(nosubSleevelessClaimed, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(nosubSleevelessClaimed, "drop-shoulder")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubSleevelessClaimed, "sleeveless")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubSleevelessClaimed, "drop-shoulder")).toBe(false);
    expect(canStartNewSleevelessPattern(nosubSleevelessClaimed)).toBe(false);
    expect(canCopySavedCustomPatternForAccess(nosubSleevelessClaimed)).toBe(false);

    expect(canCreatePatternForSystem(nosubDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canCreatePatternForSystem(nosubDropShoulderClaimed, "sleeveless")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canEditPatternSettingsForSystem(nosubDropShoulderClaimed, "sleeveless")).toBe(false);
    expect(canStartNewSleevelessPattern(nosubDropShoulderClaimed)).toBe(false);
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

describe("pattern membership gating (no localhost bypass)", () => {
  it("never grants access without an active membership plan", async () => {
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
    });
  });
});
