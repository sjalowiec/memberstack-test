import { describe, expect, it } from "vitest";
import { decidePatternMembershipGate } from "./patternMembershipPageGate";
import { LOGGED_OUT_SLEEVELESS_ACCESS, type SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

const nosub: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_nosub",
  activePlanIds: [],
  hasSystemAccess: false,
  freeClaimsBySystem: {},
};

const canceled: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_canceled",
  activePlanIds: [],
  hasSystemAccess: false,
  freeClaimsBySystem: {
    sleeveless: { claimed: true, patternId: "pat_old" },
  },
};

const member: SleevelessUserAccess = {
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimsBySystem: {},
};

describe("decidePatternMembershipGate", () => {
  it("keeps anonymous visitors locked (no catalog/builder content)", () => {
    expect(decidePatternMembershipGate(LOGGED_OUT_SLEEVELESS_ACCESS, "loggedOut").state).toBe(
      "locked",
    );
  });

  it("keeps logged-in non-members on the membership message (not anonymous signup)", () => {
    expect(decidePatternMembershipGate(nosub, "loggedInNoAccess").state).toBe("locked-no-access");
    expect(decidePatternMembershipGate(canceled, "loggedInNoAccess").state).toBe(
      "locked-no-access",
    );
  });

  it("unlocks active members and lifetime/system entitlement holders", () => {
    expect(decidePatternMembershipGate(member, "memberAccess").state).toBe("member");
    expect(
      decidePatternMembershipGate(
        { ...member, hasSystemAccess: true },
        "loggedInNoAccess",
      ).state,
    ).toBe("member");
  });

  it("unlocks when viewer reports memberAccess even if access snapshot lags", () => {
    expect(decidePatternMembershipGate(nosub, "memberAccess").state).toBe("member");
  });
});
