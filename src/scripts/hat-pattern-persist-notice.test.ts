import { describe, expect, it } from "vitest";
import {
  applyHatPatternPersistNotice,
  resolveHatPatternPersistNotice,
} from "../lib/patterns/hat/hatPatternPersistNotice";

/** Minimal ParentNode stub — no jsdom required. */
function persistRoot(hidden: boolean): {
  root: ParentNode;
  notice: { hidden: boolean };
  membership: { hidden: boolean };
} {
  const notice = { hidden };
  const membership = { hidden };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-hat-pattern-persist-notice]") {
        return notice as unknown as HTMLElement;
      }
      if (selector === "[data-hat-pattern-persist-membership]") {
        return membership as unknown as HTMLElement;
      }
      return null;
    },
  };
  return { root: root as unknown as ParentNode, notice, membership };
}

describe("applyHatPatternPersistNotice", () => {
  it("shows the temporary-pattern notice and membership pitch for logged-out and logged-in non-members", () => {
    const loggedOut = persistRoot(true);
    applyHatPatternPersistNotice(loggedOut.root, "loggedOut");
    expect(loggedOut.notice.hidden).toBe(false);
    expect(loggedOut.membership.hidden).toBe(false);
    expect(resolveHatPatternPersistNotice("loggedOut").showNotice).toBe(true);
    expect(resolveHatPatternPersistNotice("loggedOut").showMembershipCta).toBe(true);

    const noAccess = persistRoot(true);
    applyHatPatternPersistNotice(noAccess.root, "loggedInNoAccess");
    expect(noAccess.notice.hidden).toBe(false);
    expect(noAccess.membership.hidden).toBe(false);
  });

  it("hides the entire temporary-pattern / Explore Membership notice for active members", () => {
    const { root, notice, membership } = persistRoot(false);
    applyHatPatternPersistNotice(root, "memberAccess");
    expect(notice.hidden).toBe(true);
    expect(membership.hidden).toBe(true);
    expect(resolveHatPatternPersistNotice("memberAccess").showNotice).toBe(false);
    expect(resolveHatPatternPersistNotice("memberAccess").showMembershipCta).toBe(false);
  });
});
