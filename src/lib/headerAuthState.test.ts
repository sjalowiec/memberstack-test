import { describe, expect, it } from "vitest";
import { MEMBERSHIPS, LEGACY_MEMBERSHIPS } from "../config/memberships";
import { hasMemberAccess, getViewerAccessState } from "./memberAccess";
import { headerAuthWindowState, resolveHeaderAuthState } from "./headerAuthState";

const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const BETA = MEMBERSHIPS.beta.memberstackPlanId;
const LEGACY = LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId;

function payload(planConnections: unknown[], id = "mem_1") {
  return {
    data: {
      member: {
        id,
        planConnections,
      },
    },
  };
}

describe("resolveHeaderAuthState", () => {
  it("anonymous visitor ? logged out, not a member", () => {
    const state = resolveHeaderAuthState(null);
    expect(state).toEqual({
      loggedIn: false,
      isMember: false,
      memberId: null,
      member: null,
    });
    expect(headerAuthWindowState(state).member).toBe(false);
    expect(hasMemberAccess(null)).toBe(false);
    expect(getViewerAccessState(null)).toBe("loggedOut");
  });

  it("logged-in user with no membership ? not a member", () => {
    const res = payload([]);
    const state = resolveHeaderAuthState(res);
    expect(state.loggedIn).toBe(true);
    expect(state.isMember).toBe(false);
    expect(state.memberId).toBe("mem_1");
    expect(headerAuthWindowState(state)).toEqual({
      loggedIn: true,
      member: false,
      memberId: "mem_1",
    });
    expect(state.isMember).toBe(hasMemberAccess(res));
    expect(getViewerAccessState(res)).toBe("loggedInNoAccess");
  });

  it("logged-in user with inactive membership ? not a member", () => {
    const res = payload([{ planId: PAID, status: "CANCELED", active: false }]);
    const state = resolveHeaderAuthState(res);
    expect(state.loggedIn).toBe(true);
    expect(state.isMember).toBe(false);
    expect(state.isMember).toBe(hasMemberAccess(res));
    expect(getViewerAccessState(res)).toBe("loggedInNoAccess");
  });

  it("active paid member ? isMember true", () => {
    const res = payload([{ planId: PAID, status: "ACTIVE" }]);
    const state = resolveHeaderAuthState(res);
    expect(state.isMember).toBe(true);
    expect(headerAuthWindowState(state).member).toBe(true);
    expect(state.isMember).toBe(hasMemberAccess(res));
    expect(getViewerAccessState(res)).toBe("memberAccess");
  });

  it("retired Beta plan alone ? isMember false (loggedInNoAccess)", () => {
    const res = payload([{ planId: BETA, status: "ACTIVE" }]);
    expect(resolveHeaderAuthState(res).isMember).toBe(false);
    expect(hasMemberAccess(res)).toBe(false);
    expect(getViewerAccessState(res)).toBe("loggedInNoAccess");
  });

  it("Beta plus active paid plan ? isMember true via paid plan", () => {
    const res = payload([
      { planId: BETA, status: "ACTIVE" },
      { planId: PAID, status: "ACTIVE" },
    ]);
    expect(resolveHeaderAuthState(res).isMember).toBe(true);
    expect(hasMemberAccess(res)).toBe(true);
    expect(getViewerAccessState(res)).toBe("memberAccess");
  });

  it("inactive Beta plan ? isMember false", () => {
    const res = payload([{ planId: BETA, status: "CANCELED", active: false }]);
    expect(resolveHeaderAuthState(res).isMember).toBe(false);
    expect(hasMemberAccess(res)).toBe(false);
  });

  it("approved legacy membership shell ? isMember true", () => {
    const res = payload([{ planId: LEGACY, status: "ACTIVE" }]);
    expect(resolveHeaderAuthState(res).isMember).toBe(true);
    expect(hasMemberAccess(res)).toBe(true);
  });

  it("Header member flag never disagrees with hasMemberAccess", () => {
    const cases = [
      null,
      payload([]),
      payload([{ planId: PAID, status: "ACTIVE" }]),
      payload([{ planId: PAID, status: "CANCELED", active: false }]),
      payload([{ planId: BETA, status: "TRIALING" }]),
      payload([{ planId: "pln_lifetime-sleeveless-pattern-builder-i2ac0rya", status: "ACTIVE" }]),
    ];
    for (const res of cases) {
      const state = resolveHeaderAuthState(res);
      expect(state.isMember).toBe(hasMemberAccess(res));
      expect(headerAuthWindowState(state).member).toBe(hasMemberAccess(res));
    }
  });
});
