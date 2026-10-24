import { describe, expect, it } from "vitest";
import { COMPLIMENTARY_MEMBER_PLAN_IDS, MEMBERSHIPS } from "../../config/memberships";
import {
  applyFormerMemberReadOnlyException,
  decidePatternMembershipGate,
  nextPatternMembershipGateState,
} from "./patternMembershipPageGate";
import {
  computeHasSystemAccessFlag,
  hasPatternSystemAccess,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

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

  it("unlocks a former member only after an owner-scoped saved-pattern load succeeds", async () => {
    const membership = decidePatternMembershipGate(nosub, "loggedInNoAccess");
    const readonly = await applyFormerMemberReadOnlyException(membership, {
      href: "https://knititnow.com/patterns/socks/pattern/?project=proj-1",
      loadOwnedProject: async () => ({ ok: true }),
    });
    expect(readonly.state).toBe("readonly");

    const missing = await applyFormerMemberReadOnlyException(membership, {
      href: "https://knititnow.com/patterns/socks/pattern/?project=proj-1",
      loadOwnedProject: async () => ({ ok: false }),
    });
    expect(missing.state).toBe("unavailable");
  });

  it("does not treat a URL project id as enough to open the Socks builder", async () => {
    const membership = decidePatternMembershipGate(nosub, "loggedInNoAccess");
    const builder = await applyFormerMemberReadOnlyException(membership, {
      href: "https://knititnow.com/patterns/socks/builder?new=1",
      loadOwnedProject: async () => ({ ok: true }),
    });
    expect(builder.state).toBe("locked-no-access");

    const edit = await applyFormerMemberReadOnlyException(membership, {
      href: "https://knititnow.com/patterns/socks/edit/?edit=1&project=proj-1",
      loadOwnedProject: async () => ({ ok: true }),
    });
    expect(edit.state).toBe("locked-no-access");
  });

  it("uses the same former-member rule for Christmas Stocking as for Socks", async () => {
    const membership = decidePatternMembershipGate(nosub, "loggedInNoAccess");
    const readonly = await applyFormerMemberReadOnlyException(membership, {
      href: "https://kin-dev.netlify.app/patterns/christmas-stocking/pattern/?project=proj-1",
      loadOwnedProject: async () => ({ ok: true }),
    });
    expect(readonly.state).toBe("readonly");

    const summary = await applyFormerMemberReadOnlyException(membership, {
      href: "https://kin-dev.netlify.app/patterns/christmas-stocking/summary/?generated=1",
      loadOwnedProject: async () => ({ ok: true }),
    });
    expect(summary.state).toBe("locked-no-access");
  });
});

describe("nextPatternMembershipGateState", () => {
  it("shows Retry (not a sales prompt) when verification fails from pending", () => {
    expect(nextPatternMembershipGateState("pending", "error", false)).toBe("error");
  });

  it("keeps a member view from a fresh verified cache through a transient failure", () => {
    expect(nextPatternMembershipGateState("member", "error", true)).toBe("member");
  });

  it("does not keep a member view once the cached verification is stale", () => {
    expect(nextPatternMembershipGateState("member", "error", false)).toBe("error");
  });

  it("applies confirmed results over an optimistic member view", () => {
    expect(nextPatternMembershipGateState("member", "locked", true)).toBe("locked");
    expect(nextPatternMembershipGateState("member", "locked-no-access", true)).toBe(
      "locked-no-access",
    );
    expect(nextPatternMembershipGateState("member", "readonly", true)).toBe("readonly");
  });
});

describe("complimentary access-through date in the pattern builders", () => {
  const COMPLIMENTARY = COMPLIMENTARY_MEMBER_PLAN_IDS[0];
  const PAID = MEMBERSHIPS.membership.memberstackPlanId;
  const EXPIRED = "2020-01-01";
  const VALID = "2099-12-31";

  /** Builds the snapshot the client resolver produces (flag computed from the same rule). */
  function access(
    fields: Omit<SleevelessUserAccess, "loggedIn" | "hasSystemAccess" | "freeClaimsBySystem">,
  ): SleevelessUserAccess {
    const base = { loggedIn: true, freeClaimsBySystem: {}, ...fields };
    return { ...base, hasSystemAccess: computeHasSystemAccessFlag(base) };
  }

  it("locks the builder when the saved complimentary date has expired and nothing else grants", () => {
    const expired = access({
      memberId: "ms_comp_expired",
      activePlanIds: [COMPLIMENTARY],
      legacyPaidThroughYmd: null,
      complimentaryThroughYmd: EXPIRED,
    });
    expect(expired.hasSystemAccess).toBe(false);
    expect(hasPatternSystemAccess(expired, "sleeveless")).toBe(false);
    expect(hasPatternSystemAccess(expired, "drop-shoulder")).toBe(false);
    expect(decidePatternMembershipGate(expired, "loggedInNoAccess").state).toBe(
      "locked-no-access",
    );
  });

  it("keeps an open complimentary plan (no saved date, or date not loaded) unlocked", () => {
    const noDate = access({
      memberId: "ms_comp_open",
      activePlanIds: [COMPLIMENTARY],
      complimentaryThroughYmd: null,
    });
    const notLoaded = access({ memberId: "ms_comp_unknown", activePlanIds: [COMPLIMENTARY] });
    expect(hasPatternSystemAccess(noDate, "sleeveless")).toBe(true);
    expect(hasPatternSystemAccess(notLoaded, "sleeveless")).toBe(true);
  });

  it("allows a complimentary date that has not yet passed", () => {
    const valid = access({
      memberId: "ms_comp_valid",
      activePlanIds: [COMPLIMENTARY],
      complimentaryThroughYmd: VALID,
    });
    expect(hasPatternSystemAccess(valid, "sleeveless")).toBe(true);
  });

  it("still allows an active paid plan alongside an expired complimentary date", () => {
    const paid = access({
      memberId: "ms_paid_comp_expired",
      activePlanIds: [PAID, COMPLIMENTARY],
      complimentaryThroughYmd: EXPIRED,
    });
    expect(hasPatternSystemAccess(paid, "sleeveless")).toBe(true);
    expect(decidePatternMembershipGate(paid, "memberAccess").state).toBe("member");
  });

  it("still allows a valid legacy paid-through date alongside an expired complimentary date", () => {
    const legacy = access({
      memberId: "ms_legacy_comp_expired",
      activePlanIds: [COMPLIMENTARY],
      legacyPaidThroughYmd: VALID,
      complimentaryThroughYmd: EXPIRED,
    });
    expect(hasPatternSystemAccess(legacy, "sleeveless")).toBe(true);
    expect(decidePatternMembershipGate(legacy, "memberAccess").state).toBe("member");
  });
});
