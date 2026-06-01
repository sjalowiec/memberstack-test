import { describe, expect, it } from "vitest";
import {
  canCreateSleevelessPattern,
  canEditSleevelessPatternNotes,
  canEditSleevelessPatternSettings,
  hasSleevelessPatternSystemAccess,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  mergeFreeClaimIntoMemberJson,
  planIdsGrantSleevelessSystemAccess,
  readFreeClaimFromMemberJson,
  readSleevelessSystemUnlockFromMemberJson,
  SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

const loggedOut = LOGGED_OUT_SLEEVELESS_ACCESS;
const freeUnclaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: false,
};
const freeClaimed: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_123",
};
const member: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: false,
};
const memberAfterClaim: SleevelessUserAccess = {
  ...member,
  freeClaimed: true,
  freeClaimedPatternId: "pat_999",
};

describe("hasSleevelessPatternSystemAccess", () => {
  it("is false for logged-out and free users, true for members/owners", () => {
    expect(hasSleevelessPatternSystemAccess(loggedOut)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(freeUnclaimed)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(freeClaimed)).toBe(false);
    expect(hasSleevelessPatternSystemAccess(member)).toBe(true);
  });
});

describe("canCreateSleevelessPattern", () => {
  it("blocks logged-out visitors", () => {
    expect(canCreateSleevelessPattern(loggedOut)).toBe(false);
  });

  it("allows a free user their first (unclaimed) pattern", () => {
    expect(canCreateSleevelessPattern(freeUnclaimed)).toBe(true);
  });

  it("blocks a free user who already claimed their pattern", () => {
    expect(canCreateSleevelessPattern(freeClaimed)).toBe(false);
  });

  it("always allows members / system owners (even after claiming)", () => {
    expect(canCreateSleevelessPattern(member)).toBe(true);
    expect(canCreateSleevelessPattern(memberAfterClaim)).toBe(true);
  });
});

describe("canEditSleevelessPatternSettings", () => {
  it("blocks logged-out visitors", () => {
    expect(canEditSleevelessPatternSettings(loggedOut)).toBe(false);
  });

  it("allows a free user while still creating, blocks after claiming", () => {
    expect(canEditSleevelessPatternSettings(freeUnclaimed)).toBe(true);
    expect(canEditSleevelessPatternSettings(freeClaimed)).toBe(false);
  });

  it("always allows members / system owners", () => {
    expect(canEditSleevelessPatternSettings(member)).toBe(true);
    expect(canEditSleevelessPatternSettings(memberAfterClaim)).toBe(true);
  });
});

describe("downgrade lifecycle (had access → entitlement ended)", () => {
  // After access ends the account keeps freeClaimed=true (allowance used) but loses system access.
  const downgraded: SleevelessUserAccess = {
    loggedIn: true,
    memberId: "ms_ex_member",
    hasSystemAccess: false,
    freeClaimed: true,
    freeClaimedPatternId: "pat_first",
  };

  it("locks creation of new patterns", () => {
    expect(canCreateSleevelessPattern(downgraded)).toBe(false);
  });

  it("locks settings/regeneration on every saved pattern", () => {
    expect(canEditSleevelessPatternSettings(downgraded)).toBe(false);
    expect(canEditSleevelessPatternSettings(downgraded, { id: "pat_first" })).toBe(false);
    expect(canEditSleevelessPatternSettings(downgraded, { id: "pat_made_while_member" })).toBe(false);
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
    expect(canEditSleevelessPatternNotes(freeClaimed)).toBe(true);
    expect(canEditSleevelessPatternNotes(member)).toBe(true);
  });
});

describe("plan entitlement", () => {
  it("grants access for known membership plan ids", () => {
    expect(planIdsGrantSleevelessSystemAccess([SLEEVELESS_SYSTEM_MEMBERSHIP_PLAN_IDS[0]])).toBe(true);
    expect(planIdsGrantSleevelessSystemAccess(["pln_unknown"])).toBe(false);
    expect(planIdsGrantSleevelessSystemAccess([])).toBe(false);
  });

  it("reads the standalone unlock flag from member JSON", () => {
    expect(readSleevelessSystemUnlockFromMemberJson({ sleevelessPatternSystemUnlocked: true })).toBe(true);
    expect(readSleevelessSystemUnlockFromMemberJson({ sleevelessPatternSystemUnlocked: false })).toBe(false);
    expect(readSleevelessSystemUnlockFromMemberJson({})).toBe(false);
    expect(readSleevelessSystemUnlockFromMemberJson(null)).toBe(false);
  });
});

describe("free claim member JSON read/merge", () => {
  it("reads an empty/absent claim", () => {
    expect(readFreeClaimFromMemberJson({})).toEqual({
      freeSleevelessPatternClaimed: false,
      freeSleevelessPatternId: undefined,
    });
    expect(readFreeClaimFromMemberJson(null)).toEqual({
      freeSleevelessPatternClaimed: false,
      freeSleevelessPatternId: undefined,
    });
  });

  it("reads a stored claim", () => {
    const json = { freeSleevelessPatternClaimed: true, freeSleevelessPatternId: "pat_abc" };
    expect(readFreeClaimFromMemberJson(json)).toEqual({
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_abc",
    });
  });

  it("merges the claim without clobbering existing keys (replace-safe)", () => {
    const existing = { preferences: { theme: "dark" }, other: 1 };
    const merged = mergeFreeClaimIntoMemberJson(existing, {
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_xyz",
    });
    expect(merged).toEqual({
      preferences: { theme: "dark" },
      other: 1,
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_xyz",
    });
    // round-trips back through the reader
    expect(readFreeClaimFromMemberJson(merged)).toEqual({
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: "pat_xyz",
    });
  });
});
