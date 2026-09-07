import { describe, expect, it, vi } from "vitest";

import {
  buildLegacyCustomerProfileUrl,
  buildMemberstackCustomerProfileUrl,
  classifyCustomerIdentifier,
  customerEmailLookupKeys,
  emailsMatchForLegacyLink,
  isEmailLikeIdentifier,
  isMemberstackMemberId,
  MEMBER_BY_EMAIL_SQL,
  normalizeCustomerEmail,
  resolveCustomerByEmail,
  resolveLegacyLinkByMemberstackEmail,
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

  it("keeps exact gmail.com matching and does not rewrite stored emails", () => {
    expect(normalizeCustomerEmail("meggleshineart@gmail.com")).toBe("meggleshineart@gmail.com");
    expect(customerEmailLookupKeys("meggleshineart@gmail.com")).toEqual([
      "meggleshineart@gmail.com",
      "meggleshineart@googlemail.com",
    ]);
    expect(emailsMatchForLegacyLink("meggleshineart@gmail.com", "meggleshineart@gmail.com")).toBe(
      true,
    );
  });

  it("associates googlemail.com with gmail.com without rewriting the historical email", () => {
    expect(normalizeCustomerEmail("beckyc.callow8@googlemail.com")).toBe(
      "beckyc.callow8@googlemail.com",
    );
    expect(customerEmailLookupKeys("beckyc.callow8@gmail.com")).toEqual([
      "beckyc.callow8@gmail.com",
      "beckyc.callow8@googlemail.com",
    ]);
    expect(
      emailsMatchForLegacyLink("beckyc.callow8@googlemail.com", "beckyc.callow8@gmail.com"),
    ).toBe(true);
    expect(normalizeCustomerEmail("beckyc.callow8@googlemail.com")).not.toBe(
      "beckyc.callow8@gmail.com",
    );
  });

  it("treats distinct googlemail and gmail dump rows as ambiguous, not a silent merge", async () => {
    const queryFn = vi.fn(async (_sql: string, params?: unknown[]) => {
      const email = String(params?.[0] ?? "");
      if (email === "same.person@gmail.com") {
        return [
          {
            memberid: "GMAIL-ID",
            email: "same.person@gmail.com",
            fristname: "A",
            lastname: "One",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      if (email === "same.person@googlemail.com") {
        return [
          {
            memberid: "GOOGLEMAIL-ID",
            email: "same.person@googlemail.com",
            fristname: "B",
            lastname: "Two",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: null,
            active: null,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const link = await resolveLegacyLinkByMemberstackEmail("same.person@gmail.com", queryFn);
    expect(link.status).toBe("ambiguous");
    if (link.status === "ambiguous") {
      expect(link.members.map((member) => member.memberid)).toEqual([
        "GMAIL-ID",
        "GOOGLEMAIL-ID",
      ]);
    }
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

  it("resolves a googlemail dump customer from a gmail.com lookup without changing the stored email", async () => {
    const queryFn = vi.fn(async (_sql: string, params?: unknown[]) => {
      if (params?.[0] === "becky@googlemail.com") {
        return [
          {
            memberid: "DAK-BECKY",
            fristname: "Rebecca",
            lastname: "Callow",
            email: "becky@googlemail.com",
            address: null,
            address2: null,
            city: null,
            state: null,
            postalcode: null,
            country: null,
            birthdayinfo: null,
            datejoined: "2026-01-17T00:00:00.000Z",
            active: 0,
            betaactive: null,
            currentsubscriber: null,
          },
        ];
      }
      return [];
    });

    const result = await resolveCustomerByEmail("becky@gmail.com", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_BY_EMAIL_SQL, ["becky@gmail.com"]);
    expect(queryFn).toHaveBeenCalledWith(MEMBER_BY_EMAIL_SQL, ["becky@googlemail.com"]);
    expect(result.memberid).toBe("DAK-BECKY");
    expect(result.member?.email).toBe("becky@googlemail.com");
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
