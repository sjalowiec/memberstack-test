import { describe, expect, it } from "vitest";
import {
  MY_PATTERNS_ACCOUNT_HREF,
  SAVED_PATTERN_ACCESS_LOADING,
  canCreatePaidPattern,
  canDeleteOwnedSavedPattern,
  canListOwnedSavedPatterns,
  canMutateSavedPatterns,
  canViewAfterOwnerScopedLoad,
  memberOwnsProjectRecord,
  ownsSavedPatternSystem,
  resolveSavedPatternAccessState,
  resolveSocksSavedPatternDestination,
  shouldRedirectSocksLandingToMyPatterns,
  shouldShowSocksCreateAction,
} from "./savedPatternAccessState";

const MEMBER_ID = "mem_owner";

describe("resolveSavedPatternAccessState", () => {
  it("stays loading until identity and pattern ownership are known", () => {
    expect(
      resolveSavedPatternAccessState({
        loading: true,
        loggedIn: true,
        memberId: MEMBER_ID,
        hasActiveAccess: true,
        hasOwnedPatterns: true,
      }).kind,
    ).toBe("loading");
    expect(SAVED_PATTERN_ACCESS_LOADING.kind).toBe("loading");
  });

  it("treats missing member id as logged out even if loggedIn is claimed", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: "  ",
      hasActiveAccess: false,
      hasOwnedPatterns: true,
    });
    expect(state.kind).toBe("loggedOut");
    expect(state.loggedIn).toBe(false);
    expect(state.hasOwnedPatterns).toBe(false);
  });

  it("counts Watson paid-through as activeMember with full mutate permission", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: true,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(state.kind).toBe("activeMember");
    expect(canMutateSavedPatterns(state)).toBe(true);
    expect(canCreatePaidPattern(state)).toBe(true);
    expect(canDeleteOwnedSavedPattern(state)).toBe(true);
  });

  it("classifies signed-in owners without paid access as formerMemberWithPatterns", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks", "sleeveless"],
    });
    expect(state.kind).toBe("formerMemberWithPatterns");
    expect(canMutateSavedPatterns(state)).toBe(false);
    expect(canCreatePaidPattern(state)).toBe(false);
    expect(canDeleteOwnedSavedPattern(state)).toBe(true);
    expect(canListOwnedSavedPatterns(state)).toBe(true);
    expect(ownsSavedPatternSystem(state, "socks")).toBe(true);
  });

  it("classifies signed-in accounts with no access and no patterns separately", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
    expect(state.kind).toBe("authenticatedWithoutAccessOrPatterns");
    expect(canMutateSavedPatterns(state)).toBe(false);
    expect(canDeleteOwnedSavedPattern(state)).toBe(false);
    expect(canListOwnedSavedPatterns(state)).toBe(true);
  });
});

describe("ownership is not a pattern id", () => {
  it("rejects empty ids and mismatched member ids", () => {
    expect(
      memberOwnsProjectRecord({
        authenticatedMemberId: MEMBER_ID,
        projectOwnerMemberId: "mem_other",
      }),
    ).toBe(false);
    expect(
      memberOwnsProjectRecord({
        authenticatedMemberId: MEMBER_ID,
        projectOwnerMemberId: "",
      }),
    ).toBe(false);
    expect(
      memberOwnsProjectRecord({
        authenticatedMemberId: MEMBER_ID,
        projectOwnerMemberId: MEMBER_ID,
      }),
    ).toBe(true);
  });

  it("does not grant view from a URL project id when the owner-scoped load failed", () => {
    const former = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(
      canViewAfterOwnerScopedLoad({
        access: former,
        ownerScopedLoadSucceeded: false,
      }),
    ).toBe(false);
    expect(
      canViewAfterOwnerScopedLoad({
        access: former,
        ownerScopedLoadSucceeded: true,
      }),
    ).toBe(true);
  });
});

describe("Socks catalog destination", () => {
  it("does not choose a destination while loading", () => {
    expect(
      resolveSocksSavedPatternDestination(
        resolveSavedPatternAccessState({
          loading: true,
          loggedIn: true,
          memberId: MEMBER_ID,
          hasActiveAccess: true,
          hasOwnedPatterns: false,
        }),
      ),
    ).toBeNull();
  });

  it("sends active members to My Patterns even with no saved Socks", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: true,
      hasOwnedPatterns: false,
    });
    expect(resolveSocksSavedPatternDestination(state)).toBe(MY_PATTERNS_ACCOUNT_HREF);
    expect(shouldRedirectSocksLandingToMyPatterns(state)).toBe(true);
    expect(shouldShowSocksCreateAction(state)).toBe(true);
  });

  it("sends former members with saved Socks to My Patterns and hides Create", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["socks"],
    });
    expect(resolveSocksSavedPatternDestination(state)).toBe(MY_PATTERNS_ACCOUNT_HREF);
    expect(shouldShowSocksCreateAction(state)).toBe(false);
  });

  it("keeps former members without Socks on the public landing", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: true,
      memberId: MEMBER_ID,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems: ["sleeveless"],
    });
    expect(resolveSocksSavedPatternDestination(state)).toBe("/patterns/socks");
    expect(shouldRedirectSocksLandingToMyPatterns(state)).toBe(false);
  });

  it("keeps logged-out visitors on the public landing", () => {
    const state = resolveSavedPatternAccessState({
      loggedIn: false,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
    expect(resolveSocksSavedPatternDestination(state)).toBe("/patterns/socks");
  });
});
