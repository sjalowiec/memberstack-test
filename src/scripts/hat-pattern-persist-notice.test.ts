import { describe, expect, it } from "vitest";
import {
  applyHatPatternPersistNoticeMembership,
  resolveHatPatternPersistNotice,
} from "../lib/patterns/hat/hatPatternPersistNotice";

/** Minimal ParentNode stub — no jsdom required. */
function membershipRoot(hidden: boolean): {
  root: ParentNode;
  membership: { hidden: boolean };
} {
  const membership = { hidden };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-hat-pattern-persist-membership]") {
        return membership as unknown as HTMLElement;
      }
      return null;
    },
  };
  return { root: root as unknown as ParentNode, membership };
}

describe("applyHatPatternPersistNoticeMembership", () => {
  it("shows the membership pitch block for logged-out and logged-in non-members", () => {
    const loggedOut = membershipRoot(true);
    applyHatPatternPersistNoticeMembership(loggedOut.root, "loggedOut");
    expect(loggedOut.membership.hidden).toBe(false);
    expect(resolveHatPatternPersistNotice("loggedOut").showMembershipCta).toBe(true);

    const noAccess = membershipRoot(true);
    applyHatPatternPersistNoticeMembership(noAccess.root, "loggedInNoAccess");
    expect(noAccess.membership.hidden).toBe(false);
  });

  it("hides the Explore Membership pitch for active members", () => {
    const { root, membership } = membershipRoot(false);
    applyHatPatternPersistNoticeMembership(root, "memberAccess");
    expect(membership.hidden).toBe(true);
    expect(resolveHatPatternPersistNotice("memberAccess").showMembershipCta).toBe(false);
  });
});
