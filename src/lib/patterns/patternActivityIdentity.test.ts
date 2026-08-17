import { describe, expect, it } from "vitest";
import {
  guestActivityUserIdFromEmail,
  membershipFromActivityEvent,
  membershipFromViewerAccess,
  membershipLabel,
  resolveActivityMembershipFromSnapshot,
} from "./patternActivityIdentity";

describe("patternActivityIdentity", () => {
  it("hashes guest email into a stable id that does not contain the address", async () => {
    const first = await guestActivityUserIdFromEmail("Ada@Example.com");
    const second = await guestActivityUserIdFromEmail(" ada@example.com ");
    expect(first).toBe(second);
    expect(first).toMatch(/^guest_[a-f0-9]{16}$/);
    expect(first).not.toContain("ada");
    expect(first).not.toContain("@");
  });

  it("classifies viewer access as free or member at event time", () => {
    expect(membershipFromViewerAccess("memberAccess")).toBe("member");
    expect(membershipFromViewerAccess("loggedInNoAccess")).toBe("free");
    expect(membershipFromViewerAccess("loggedOut")).toBe("free");
  });

  it("reads membership from the page snapshot", () => {
    expect(
      resolveActivityMembershipFromSnapshot({
        hasMemberAccess: true,
        viewerAccessState: "memberAccess",
      }),
    ).toBe("member");
    expect(
      resolveActivityMembershipFromSnapshot({
        hasMemberAccess: false,
        viewerAccessState: "loggedInNoAccess",
      }),
    ).toBe("free");
    expect(resolveActivityMembershipFromSnapshot(null)).toBe("free");
  });

  it("treats historical events without membership as unknown", () => {
    expect(membershipFromActivityEvent({ metadata: { membership: "member" } })).toBe("member");
    expect(membershipFromActivityEvent({ metadata: { membership: "free" } })).toBe("free");
    expect(membershipFromActivityEvent({ metadata: {} })).toBe("unknown");
    expect(membershipFromActivityEvent({})).toBe("unknown");
    expect(membershipLabel("unknown")).toBe("Unknown");
    expect(membershipLabel("free")).toBe("Free");
    expect(membershipLabel("member")).toBe("Member");
  });
});
