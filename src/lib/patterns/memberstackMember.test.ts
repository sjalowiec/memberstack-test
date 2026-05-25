import { describe, expect, it } from "vitest";
import { isMemberstackLoggedInPayload, memberIdFromMemberstackPayload } from "./memberstackMember";

describe("memberstackMember", () => {
  it("reads member id from nested data", () => {
    expect(memberIdFromMemberstackPayload({ data: { id: "ms_abc" } })).toBe("ms_abc");
  });

  it("reads member id from auth.id", () => {
    expect(memberIdFromMemberstackPayload({ data: { auth: { id: "ms_auth" } } })).toBe("ms_auth");
  });

  it("returns undefined for empty payload", () => {
    expect(memberIdFromMemberstackPayload(null)).toBeUndefined();
    expect(isMemberstackLoggedInPayload(null)).toBe(false);
  });
});
