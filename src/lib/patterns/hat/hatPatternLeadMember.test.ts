import { describe, expect, it } from "vitest";
import { readKnownHatLeadMember } from "./hatPatternLeadMember";

describe("readKnownHatLeadMember", () => {
  it("reads email from a Memberstack payload without requiring a plan", async () => {
    const member = await readKnownHatLeadMember({
      getMember: async () => ({
        data: {
          id: "ms_1",
          auth: { email: "ada@example.com", firstName: "Ada" },
          planConnections: [],
        },
      }),
    });
    expect(member).toEqual({
      email: "ada@example.com",
      firstName: "Ada",
      loggedIn: true,
    });
  });

  it("returns null for a logged-out payload", async () => {
    const guest = await readKnownHatLeadMember({
      getMember: async () => ({ data: null }),
    });
    expect(guest).toBeNull();
  });
});
