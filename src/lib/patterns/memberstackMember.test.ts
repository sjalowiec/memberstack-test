import { describe, expect, it } from "vitest";
import {
  accountWelcomeGreetingFromMemberstackPayload,
  isMemberstackLoggedInPayload,
  memberDisplayFirstNameFromMemberstackPayload,
  memberEmailFromMemberstackPayload,
  memberFirstNameFromMemberstackPayload,
  memberIdFromMemberstackPayload,
} from "./memberstackMember";

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

  it("reads first name from custom fields", () => {
    expect(
      memberFirstNameFromMemberstackPayload({
        data: { customFields: { "first-name": " Sue " } },
      }),
    ).toBe("Sue");
  });

  it("reads first name from auth.firstName when custom fields are empty", () => {
    expect(
      memberFirstNameFromMemberstackPayload({
        data: { auth: { firstName: " Mary " } },
      }),
    ).toBe("Mary");
  });

  it("does not use email as a first-name fallback", () => {
    expect(
      memberFirstNameFromMemberstackPayload({
        data: { auth: { email: "knitter@example.com" } },
      }),
    ).toBeUndefined();
  });

  it("falls back to email local part when first name is missing", () => {
    expect(
      memberDisplayFirstNameFromMemberstackPayload({
        data: { auth: { email: "knitter@example.com" } },
      }),
    ).toBe("knitter");
  });

  it("builds welcome greeting with and without a display name", () => {
    expect(
      accountWelcomeGreetingFromMemberstackPayload({
        data: { customFields: { "first-name": "Pat" } },
      }),
    ).toBe("Welcome back, Pat");
    expect(accountWelcomeGreetingFromMemberstackPayload({ data: {} })).toBe("Welcome back");
  });

  it("reads member email from auth", () => {
    expect(
      memberEmailFromMemberstackPayload({
        data: { auth: { email: "member@example.com" } },
      }),
    ).toBe("member@example.com");
  });
});
