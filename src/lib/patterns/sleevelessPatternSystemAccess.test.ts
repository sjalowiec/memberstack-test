import { describe, expect, it } from "vitest";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  canCreatePatternForSystem,
  canCreateSleevelessPattern,
  canEditSleevelessPatternNotes,
  canEditSleevelessPatternSettings,
  hasPatternSystemAccess,
  hasSleevelessPatternSystemAccess,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  mergeFreeClaimIntoMemberJson,
  mergeFreeClaimResetIntoMemberJson,
  planIdsGrantSleevelessSystemAccess,
  readFreeClaimFromMemberJson,
  readSleevelessSystemUnlockFromMemberJson,
  resolvePatternSystemAccess,
  SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { readFreeClaimsBySystemFromMemberJson } from "./patternSystemFreeClaim";

const loggedOut = LOGGED_OUT_SLEEVELESS_ACCESS;
const freeUnclaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimsBySystem: {},
};
const freeSleevelessClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    sleeveless: { claimed: true, patternId: "pat_123" },
  },
};
const freeDropShoulderClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimsBySystem: {
    "drop-shoulder": { claimed: true, patternId: "pat_ds" },
  },
};
const member: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  activePlanIds: [MEMBERSHIPS.basic.memberstackPlanId],
  hasSystemAccess: true,
  freeClaimsBySystem: {},
};
const sleevelessLifetimeOwner: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_lifetime_sl",
  activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
  hasSystemAccess: true,
  freeClaimsBySystem: {},
};
const dropShoulderLifetimeOwner: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_lifetime_ds",
  activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId],
  hasSystemAccess: true,
  freeClaimsBySystem: {},
};
const memberAfterClaim: SleevelessUserAccess = {
  ...member,
  freeClaimsBySystem: {
    sleeveless: { claimed: true, patternId: "pat_999" },
  },
};

describe("hasSleevelessPatternSystemAccess", () => {
  it("is false for logged-out and free users, true for members/owners", () => {
    expect(hasSleevelessPatternSystemAccess(loggedOut)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(freeUnclaimed)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(freeSleevelessClaimed)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(member)).toBe(true);
  });
});

describe("canCreatePatternForSystem (per-system)", () => {
  it("blocks logged-out visitors", () => {
    expect(canCreatePatternForSystem(loggedOut, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(loggedOut, "drop-shoulder")).toBe(false);
  });

  it("allows a free user their first pattern per system independently", () => {
    expect(canCreatePatternForSystem(freeUnclaimed, "sleeveless")).toBe(true);
    expect(canCreatePatternForSystem(freeUnclaimed, "drop-shoulder")).toBe(true);
  });

  it("blocks only the claimed system, not other systems", () => {
    expect(canCreatePatternForSystem(freeSleevelessClaimed, "sleeveless")).toBe(false);
    expect(canCreatePatternForSystem(freeSleevelessClaimed, "drop-shoulder")).toBe(true);

    expect(canCreatePatternForSystem(freeDropShoulderClaimed, "drop-shoulder")).toBe(false);
    expect(canCreatePatternForSystem(freeDropShoulderClaimed, "sleeveless")).toBe(true);
  });

  it("always allows members / system owners", () => {
    expect(canCreatePatternForSystem(member, "sleeveless")).toBe(true);
    expect(canCreatePatternForSystem(memberAfterClaim, "sleeveless")).toBe(true);
    expect(canCreatePatternForSystem(memberAfterClaim, "drop-shoulder")).toBe(true);
  });
});

describe("canCreateSleevelessPattern (default system)", () => {
  it("uses sleeveless as the default system id", () => {
    expect(canCreateSleevelessPattern(freeUnclaimed)).toBe(true);
    expect(canCreateSleevelessPattern(freeSleevelessClaimed)).toBe(false);
  });
});

describe("canEditSleevelessPatternSettings", () => {
  it("blocks logged-out visitors", () => {
    expect(canEditSleevelessPatternSettings(loggedOut)).toBe(false);
  });

  it("allows a free user while still creating, blocks after claiming for that system", () => {
    expect(canEditSleevelessPatternSettings(freeUnclaimed)).toBe(true);
    expect(canEditSleevelessPatternSettings(freeSleevelessClaimed)).toBe(false);
    expect(canEditSleevelessPatternSettings(freeSleevelessClaimed, "drop-shoulder")).toBe(true);
  });

  it("always allows members / system owners", () => {
    expect(canEditSleevelessPatternSettings(member)).toBe(true);
    expect(canEditSleevelessPatternSettings(memberAfterClaim)).toBe(true);
  });
});

describe("downgrade lifecycle (had access → entitlement ended)", () => {
  const downgraded: SleevelessUserAccess = {
    loggedIn: true,
    memberId: "ms_ex_member",
    hasSystemAccess: false,
    freeClaimsBySystem: {
      sleeveless: { claimed: true, patternId: "pat_first" },
    },
  };

  it("locks creation of new patterns for claimed systems", () => {
    expect(canCreatePatternForSystem(downgraded, "sleeveless")).toBe(false);
  });

  it("locks settings/regeneration on claimed systems", () => {
    expect(canEditSleevelessPatternSettings(downgraded)).toBe(false);
    expect(canEditSleevelessPatternSettings(downgraded, "drop-shoulder")).toBe(true);
  });

  it("keeps title/notes editable (library management)", () => {
    expect(canEditSleevelessPatternNotes(downgraded)).toBe(true);
  });
});

describe("canEditSleevelessPatternNotes", () => {
  it("blocks logged-out visitors", () => {
    expect(canEditSleevelessPatternNotes(loggedOut)).toBe(false);
  });

  it("allows any logged-in user (free claimed included) to edit title/notes", () => {
    expect(canEditSleevelessPatternNotes(freeUnclaimed)).toBe(true);
    expect(canEditSleevelessPatternNotes(freeSleevelessClaimed)).toBe(true);
    expect(canEditSleevelessPatternNotes(member)).toBe(true);
  });
});

describe("hasPatternSystemAccess (lifetime builder ownership)", () => {
  it("grants Sleeveless-only access for a Sleeveless lifetime plan", () => {
    expect(hasPatternSystemAccess(sleevelessLifetimeOwner, "sleeveless")).toBe(true);
    expect(hasPatternSystemAccess(sleevelessLifetimeOwner, "drop-shoulder")).toBe(false);
  });

  it("grants Drop Shoulder-only access for a Drop Shoulder lifetime plan", () => {
    expect(hasPatternSystemAccess(dropShoulderLifetimeOwner, "drop-shoulder")).toBe(true);
    expect(hasPatternSystemAccess(dropShoulderLifetimeOwner, "sleeveless")).toBe(false);
  });

  it("still allows a lifetime owner their one free pattern on the other system", () => {
    expect(canCreatePatternForSystem(sleevelessLifetimeOwner, "drop-shoulder")).toBe(true);
    expect(canCreatePatternForSystem(dropShoulderLifetimeOwner, "sleeveless")).toBe(true);
  });

  it("resolves per-system access from active plan ids", () => {
    expect(
      resolvePatternSystemAccess({
        activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
        patternSystemId: "sleeveless",
      }).hasSystemAccess,
    ).toBe(true);
    expect(
      resolvePatternSystemAccess({
        activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
        patternSystemId: "drop-shoulder",
      }).hasSystemAccess,
    ).toBe(false);
  });
});

describe("plan entitlement", () => {
  it("grants access for known membership plan ids", () => {
    expect(planIdsGrantSleevelessSystemAccess([SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS[0]])).toBe(true);
    expect(planIdsGrantSleevelessSystemAccess(["pln_unknown"])).toBe(false);
    expect(planIdsGrantSleevelessSystemAccess([])).toBe(false);
  });

  it("grants access for the Beta Access plan id", () => {
    expect(SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS).toContain("pln_kin-beta-access-vyek0a38");
    expect(planIdsGrantSleevelessSystemAccess(["pln_kin-beta-access-vyek0a38"])).toBe(true);
  });

  it("reads the standalone unlock flag from member JSON", () => {
    expect(readSleevelessSystemUnlockFromMemberJson({ sleevelessPatternSystemUnlocked: true })).toBe(true);
    expect(readSleevelessSystemUnlockFromMemberJson({ sleevelessPatternSystemUnlocked: false })).toBe(false);
    expect(readSleevelessSystemUnlockFromMemberJson({})).toBe(false);
    expect(readSleevelessSystemUnlockFromMemberJson(null)).toBe(false);
  });
});

describe("free claim member JSON read/merge", () => {
  it("reads an empty/absent claim (legacy)", () => {
    expect(readFreeClaimFromMemberJson({})).toEqual({
      freeSleevelessPatternClaimed: false,
      freeSleevelessPatternId: undefined,
    });
  });

  it("reads per-system claims and migrates legacy keys", () => {
    const json = {
      freePatternClaimsBySystem: {
        "drop-shoulder": { claimed: true, patternId: "pat_ds" },
      },
    };
    expect(readFreeClaimsBySystemFromMemberJson(json)).toEqual({
      "drop-shoulder": { claimed: true, patternId: "pat_ds" },
    });
  });

  it("migrates legacy sleeveless keys into per-system claims", () => {
    const json = { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "pat_abc" };
    expect(readFreeClaimsBySystemFromMemberJson(json)).toEqual({
      sleeveless: { claimed: true, patternId: "pat_abc" },
    });
  });

  it("merges legacy claim without clobbering existing keys", () => {
    const existing = { preferences: { theme: "dark" }, other: 1 };
    const merged = mergeFreeClaimIntoMemberJson(existing, {
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_xyz",
    });
    expect(merged.preferences).toEqual({ theme: "dark" });
    expect(readFreeClaimFromMemberJson(merged)).toEqual({
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_xyz",
    });
  });

  it("resets legacy claim without clobbering unrelated keys", () => {
    const existing = {
      preferences: { theme: "dark" },
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_old",
    };
    const reset = mergeFreeClaimResetIntoMemberJson(existing);
    expect(reset.preferences).toEqual({ theme: "dark" });
    expect(readFreeClaimFromMemberJson(reset)).toEqual({
      freeSleevelessPatternClaimed: false,
      freeSleevelessPatternId: undefined,
    });
  });
});
