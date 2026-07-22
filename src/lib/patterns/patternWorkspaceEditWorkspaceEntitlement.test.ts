import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COURSE_ACCESS_PLAN_IDS,
  LEGACY_MEMBERSHIPS,
  LEGACY_PAID_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
  MEMBER_PLAN_IDS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import { LOGGED_OUT_SLEEVELESS_ACCESS } from "./sleevelessPatternSystemAccess";
import { testAccess } from "./patternAccessTestFixtures";
import {
  blockPatternWorkspaceSettingsEditOrOfferUnlock,
  canOpenPatternWorkspaceEditWorkspace,
  isPatternWorkspaceSettingsEditingLocked,
} from "./patternWorkspaceSettingsEditAccess";
import {
  applyLockedPatternEditButtonState,
  showPatternEditingUnlockModal,
} from "./patternEditingUnlockModal";

vi.mock("./patternEditingUnlockModal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patternEditingUnlockModal")>();
  return {
    ...actual,
    showPatternEditingUnlockModal: vi.fn(() => true),
  };
});

const editDrawerSrc = readFileSync(
  resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
  "utf8",
);

const betaMember = testAccess({ loggedIn: true, hasSystemAccess: true, memberId: "ms_beta" });
const legacyMonthlyBasicMember = testAccess({
  loggedIn: true,
  hasSystemAccess: true,
  memberId: "ms_legacy_basic",
  activePlanIds: [LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId],
});
const paidMember = testAccess({ loggedIn: true, hasSystemAccess: true, memberId: "ms_member" });
const freeUnclaimed = testAccess({
  loggedIn: true,
  hasSystemAccess: false,
  memberId: "ms_nosub",
  freeClaimed: false,
});
const freeClaimed = testAccess({
  loggedIn: true,
  hasSystemAccess: false,
  memberId: "ms_nosub",
  freeClaimed: true,
  claimedSystem: "drop-shoulder",
  freeClaimedPatternId: "pat_ds",
});

describe("canOpenPatternWorkspaceEditWorkspace", () => {
  it("allows Beta, remaining legacy monthly Basic, and paid members", () => {
    expect(canOpenPatternWorkspaceEditWorkspace(betaMember)).toBe(true);
    expect(canOpenPatternWorkspaceEditWorkspace(legacyMonthlyBasicMember)).toBe(true);
    expect(canOpenPatternWorkspaceEditWorkspace(paidMember)).toBe(true);
  });

  it("denies free claimed, free unclaimed, and logged-out users", () => {
    expect(canOpenPatternWorkspaceEditWorkspace(freeUnclaimed)).toBe(false);
    expect(canOpenPatternWorkspaceEditWorkspace(freeClaimed)).toBe(false);
    expect(canOpenPatternWorkspaceEditWorkspace(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(false);
  });
});

describe("isPatternWorkspaceSettingsEditingLocked", () => {
  it("locks every non-member tier regardless of per-system free-claim state", () => {
    expect(isPatternWorkspaceSettingsEditingLocked(freeUnclaimed, "drop-shoulder")).toBe(true);
    expect(isPatternWorkspaceSettingsEditingLocked(freeClaimed, "drop-shoulder")).toBe(true);
    expect(isPatternWorkspaceSettingsEditingLocked(freeClaimed, "sleeveless")).toBe(true);
    expect(isPatternWorkspaceSettingsEditingLocked(LOGGED_OUT_SLEEVELESS_ACCESS)).toBe(true);
  });

  it("unlocks members for any pattern system context", () => {
    expect(isPatternWorkspaceSettingsEditingLocked(betaMember, "drop-shoulder")).toBe(false);
    expect(isPatternWorkspaceSettingsEditingLocked(paidMember, "sleeveless")).toBe(false);
  });
});

describe("blockPatternWorkspaceSettingsEditOrOfferUnlock", () => {
  beforeEach(() => {
    vi.mocked(showPatternEditingUnlockModal).mockClear();
  });

  it("offers the unlock modal for logged-in free users", () => {
    const blocked = blockPatternWorkspaceSettingsEditOrOfferUnlock(freeUnclaimed, "drop-shoulder");
    expect(blocked).toBe(true);
    expect(showPatternEditingUnlockModal).toHaveBeenCalledWith({
      force: true,
      patternSystem: "drop-shoulder",
    });
  });

  it("blocks logged-out users without offering the membership modal", () => {
    const blocked = blockPatternWorkspaceSettingsEditOrOfferUnlock(
      LOGGED_OUT_SLEEVELESS_ACCESS,
      "drop-shoulder",
    );
    expect(blocked).toBe(true);
    expect(showPatternEditingUnlockModal).not.toHaveBeenCalled();
  });

  it("returns false for members", () => {
    expect(blockPatternWorkspaceSettingsEditOrOfferUnlock(betaMember, "drop-shoulder")).toBe(false);
    expect(showPatternEditingUnlockModal).not.toHaveBeenCalled();
  });
});

describe("edit drawer integration", () => {
  it("gates openDrawer through blockPatternWorkspaceSettingsEditOrOfferUnlock", () => {
    expect(editDrawerSrc).toContain("blockPatternWorkspaceSettingsEditOrOfferUnlock");
    expect(editDrawerSrc).not.toContain("offerPatternEditingUnlockModal(resolvedAccess");
  });

  it("routes ?edit=1 auto-open through openDrawer so access cannot be bypassed", () => {
    expect(editDrawerSrc).toContain("maybeAutoOpenFromQuery");
    expect(editDrawerSrc).toContain('get("edit") === "1"');
    expect(editDrawerSrc).toContain("void openDrawer()");
  });

  it("marks the Edit button non-actionable when locked", () => {
    const button = {
      hidden: false,
      classList: { toggle: vi.fn() },
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as HTMLElement;

    applyLockedPatternEditButtonState(button, true);
    expect(button.classList.toggle).toHaveBeenCalledWith("is-disabled", true);
    expect(button.setAttribute).toHaveBeenCalledWith("aria-disabled", "true");
  });
});

describe("membership plan ids grant edit workspace access", () => {
  it("includes beta, membership, and remaining legacy plan ids; excludes removed Basic", () => {
    expect(MEMBERSHIPS.beta.memberstackPlanId).toBe("pln_kin-beta-access-vyek0a38");
    expect(MEMBERSHIPS.membership.memberstackPlanId).toBe(
      "pln_kin-membership-annual-premium-tn5b0cxj",
    );
    expect(REMOVED_BASIC_MEMBERSHIP_PLAN_ID).toBe("pln_kin-membership-annual-basic-je3s0vpe");

    for (const ids of [MEMBER_PLAN_IDS, COURSE_ACCESS_PLAN_IDS, LEGACY_PAID_MEMBER_PLAN_IDS]) {
      expect(ids).not.toContain(REMOVED_BASIC_MEMBERSHIP_PLAN_ID);
    }

    expect(MEMBER_PLAN_IDS).toContain(MEMBERSHIPS.beta.memberstackPlanId);
    expect(MEMBER_PLAN_IDS).toContain(MEMBERSHIPS.membership.memberstackPlanId);
    expect(COURSE_ACCESS_PLAN_IDS).toContain(MEMBERSHIPS.beta.memberstackPlanId);
    expect(COURSE_ACCESS_PLAN_IDS).toContain(MEMBERSHIPS.membership.memberstackPlanId);

    expect(LEGACY_PAID_MEMBER_PLAN_IDS).toContain(
      LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
    );
    expect(LEGACY_PAID_MEMBER_PLAN_IDS).toContain(
      LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId,
    );
    expect(LEGACY_PAID_MEMBER_PLAN_IDS).toContain(
      LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId,
    );
    expect(LEGACY_PAID_MEMBER_PLAN_IDS).toContain(
      LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
    );
    expect(MEMBER_PLAN_IDS).toEqual(expect.arrayContaining([...LEGACY_PAID_MEMBER_PLAN_IDS]));
    expect(COURSE_ACCESS_PLAN_IDS).toEqual(expect.arrayContaining([...LEGACY_PAID_MEMBER_PLAN_IDS]));
  });
});
