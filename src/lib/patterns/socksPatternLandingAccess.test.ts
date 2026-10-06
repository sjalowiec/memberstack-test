import { describe, expect, it } from "vitest";
import { resolveSavedPatternAccessState, MY_PATTERNS_ACCOUNT_HREF } from "./savedPatternAccessState";
import { resolveSocksLandingAction } from "./socksPatternLandingAccess";

const MEMBER_ID = "mem_owner";

describe("resolveSocksLandingAction", () => {
  it("stays pending while access is loading so prospect CTAs cannot flash", () => {
    const state = resolveSavedPatternAccessState({
      loading: true,
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: true,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(resolveSocksLandingAction(state)).toEqual({ type: "pending" });
  });

  it("shows the member builder CTA for active members, including those with saved Socks", () => {
    const active = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: true,
      hasOwnedPatterns: false,
    });
    expect(resolveSocksLandingAction(active)).toEqual({ type: "show-member" });

    const activeWithSocks = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: true,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(resolveSocksLandingAction(activeWithSocks)).toEqual({ type: "show-member" });
  });

  it("redirects former members with saved Socks to My Patterns", () => {
    const formerWithSocks = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(resolveSocksLandingAction(formerWithSocks)).toEqual({
      type: "redirect",
      href: MY_PATTERNS_ACCOUNT_HREF,
    });
  });

  it("keeps visitors and accounts without saved Socks on the public landing", () => {
    const loggedOut = resolveSavedPatternAccessState({
      loggedIn: false,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
    expect(resolveSocksLandingAction(loggedOut)).toEqual({ type: "show-prospect" });

    const signedInNonMember = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
    expect(resolveSocksLandingAction(signedInNonMember)).toEqual({ type: "show-prospect" });

    const formerNoSocks = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["sleeveless"],
    });
    expect(resolveSocksLandingAction(formerNoSocks)).toEqual({ type: "show-prospect" });
  });
});
