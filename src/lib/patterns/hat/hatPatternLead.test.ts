import { describe, expect, it } from "vitest";
import { decideHatPatternLeadCapture } from "./hatPatternLead";
import { HAT_PATTERN_LEAD_TAG } from "./hatPatternLeadShared";

describe("decideHatPatternLeadCapture", () => {
  it("asks a logged-out unrecognized visitor for email", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: false,
        memberEmail: null,
      }),
    ).toEqual({ action: "show-capture" });
  });

  it("lets a recognized guest continue without the form", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: true,
        memberEmail: null,
      }),
    ).toEqual({ action: "continue" });
  });

  it("silently tags a known Memberstack email without showing the form", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: false,
        memberEmail: "ada@example.com",
        memberFirstName: "Ada",
      }),
    ).toEqual({
      action: "submit-known-email",
      email: "ada@example.com",
      firstName: "Ada",
    });
  });

  it("skips the form for a logged-in visitor even without a readable email", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: false,
        memberEmail: null,
        memberLoggedIn: true,
      }),
    ).toEqual({ action: "continue" });
  });

  it("does not require membership or saved-project privileges", () => {
    const guest = decideHatPatternLeadCapture({
      alreadyCaptured: false,
      memberEmail: "ada@example.com",
    });
    const loggedInNoAccess = decideHatPatternLeadCapture({
      alreadyCaptured: false,
      memberEmail: "ada@example.com",
      memberLoggedIn: true,
    });
    expect(guest).toEqual(loggedInNoAccess);
    expect(guest.action).toBe("submit-known-email");
    expect(JSON.stringify(guest)).not.toMatch(/memberAccess|hasMemberSavedProjectPrivileges|plan/i);
  });
});

describe("Hat Pattern lead tag", () => {
  it("uses the Hat-specific ActiveCampaign tag", () => {
    expect(HAT_PATTERN_LEAD_TAG).toBe("Lead: Hat Pattern");
  });
});
