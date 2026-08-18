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

  it("asks a loggedInNoAccess visitor without a known email or lead marker", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: false,
        memberEmail: null,
      }),
    ).toEqual({ action: "show-capture" });
  });

  it("asks a memberAccess visitor without a known email or lead marker", () => {
    expect(
      decideHatPatternLeadCapture({
        alreadyCaptured: false,
        memberEmail: "",
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

  it("does not skip capture based on login or membership state", () => {
    const unrecognized = decideHatPatternLeadCapture({
      alreadyCaptured: false,
      memberEmail: null,
    });
    expect(unrecognized).toEqual({ action: "show-capture" });
    expect(JSON.stringify(unrecognized)).not.toMatch(
      /memberAccess|loggedInNoAccess|hasMemberSavedProjectPrivileges|plan/i,
    );
  });

  it("does not require membership or saved-project privileges to tag a known email", () => {
    const guest = decideHatPatternLeadCapture({
      alreadyCaptured: false,
      memberEmail: "ada@example.com",
    });
    expect(guest).toEqual({
      action: "submit-known-email",
      email: "ada@example.com",
    });
    expect(JSON.stringify(guest)).not.toMatch(
      /memberAccess|hasMemberSavedProjectPrivileges|plan/i,
    );
  });
});

describe("Hat Pattern lead tag", () => {
  it("uses the Hat-specific ActiveCampaign tag", () => {
    expect(HAT_PATTERN_LEAD_TAG).toBe("Lead: Hat Pattern");
  });
});
