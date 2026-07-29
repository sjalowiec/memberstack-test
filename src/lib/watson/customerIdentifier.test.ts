import { describe, expect, it, vi } from "vitest";

import {
  buildLegacyCustomerProfileUrl,
  buildMemberstackCustomerProfileUrl,
  classifyCustomerIdentifier,
  emailsMatchForLegacyLink,
  isEmailLikeIdentifier,
  isMemberstackMemberId,
  MEMBER_BY_EMAIL_SQL,
  normalizeCustomerEmail,
  resolveCustomerByEmail,
} from "./customerIdentifier";

describe("customerIdentifier", () => {
  it("classifies identifier kinds", () => {
    expect(classifyCustomerIdentifier("M12345")).toBe("memberid");
    expect(classifyCustomerIdentifier("sue@example.com")).toBe("email");
    expect(classifyCustomerIdentifier("mem_abc123")).toBe("memberstack_id");
  });

  it("detects email and memberstack patterns", () => {
    expect(isEmailLikeIdentifier("sue@example.com")).toBe(true);
    expect(isEmailLikeIdentifier("Sue")).toBe(false);
    expect(isMemberstackMemberId("mem_test123")).toBe(true);
    expect(isMemberstackMemberId("M123")).toBe(false);
  });

  it("selects subscriptionexpiring so the memberstack route reads the authoritative paid-through date", () => {
    // Regression: without this column the Memberstack profile fell back to a
    // stale legacy_subscriptions timeline event after a paid-through edit.
    expect(MEMBER_BY_EMAIL_SQL).toContain("subscriptionexpiring");
  });

  it("normalizes emails for exact legacy linking", () => {
    expect(normalizeCustomerEmail("  Sue@Example.com ")).toBe("sue@example.com");
    expect(emailsMatchForLegacyLink("Sue@Example.com", "sue@example.com")).toBe(true);
    expect(emailsMatchForLegacyLink("other@example.com", "sue@example.com")).toBe(false);
  });

  it("resolves customers by exact email", async () => {
    const queryFn = vi.fn(async () => [
      {
        memberid: "M1",
        fristname: "Sue",
        lastname: "Hall",
        email: "sue@example.com",
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
        birthdayinfo: null,
        datejoined: "2020-01-02T00:00:00.000Z",
        active: 1,
        betaactive: null,
        currentsubscriber: null,
      },
    ]);

    const result = await resolveCustomerByEmail("  Sue@Example.com  ", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_BY_EMAIL_SQL, ["sue@example.com"]);
    expect(result.memberid).toBe("M1");
    expect(result.member?.email).toBe("sue@example.com");
  });

  it("builds typed profile URLs", () => {
    expect(buildLegacyCustomerProfileUrl("M12345")).toBe("/watson/customers/legacy/M12345");
    expect(buildLegacyCustomerProfileUrl("M12345", "sue")).toBe(
      "/watson/customers/legacy/M12345?q=sue",
    );
    expect(buildMemberstackCustomerProfileUrl("mem_abc123")).toBe(
      "/watson/customers/memberstack/mem_abc123",
    );
    expect(buildMemberstackCustomerProfileUrl("mem_abc123", "sue")).toBe(
      "/watson/customers/memberstack/mem_abc123?q=sue",
    );
  });
});
