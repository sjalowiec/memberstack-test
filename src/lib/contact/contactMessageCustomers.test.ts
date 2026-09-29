import { describe, expect, it, vi } from "vitest";

import {
  CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL,
  contactCustomerHrefForMatches,
  resolveContactMessageCustomerHref,
} from "./contactMessageCustomers";

describe("contact message customer link", () => {
  it("links only when exactly one customer record matches", () => {
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: ["M1"], memberstackIds: [] }),
    ).toBe("/watson/customers/legacy/M1");
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: [], memberstackIds: ["mem_abc"] }),
    ).toBe("/watson/customers/memberstack/mem_abc");
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: [], memberstackIds: [] }),
    ).toBeNull();
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: ["M1", "M2"], memberstackIds: [] }),
    ).toBeNull();
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: ["M1"], memberstackIds: ["mem_abc"] }),
    ).toBeNull();
    expect(
      contactCustomerHrefForMatches({ legacyMemberids: ["M1"], memberstackIds: null }),
    ).toBeNull();
  });

  it("queries the normalized email and does not guess when Memberstack is unknown", async () => {
    expect(CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL).toContain("LOWER(TRIM(email)) = $1");
    expect(CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL).not.toContain("googlemail");
    expect(CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL).not.toMatch(/\bUPDATE\b|\bDELETE\b/i);

    const queryFn = vi.fn().mockResolvedValueOnce([{ memberid: "M1" }]);
    await expect(
      resolveContactMessageCustomerHref("  Sue@Example.com ", {
        queryFn,
        lookupMemberstack: async () => ({ status: "none" }),
      }),
    ).resolves.toBe("/watson/customers/legacy/M1");
    expect(queryFn).toHaveBeenCalledWith(CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL, ["sue@example.com"]);

    const ambiguous = vi.fn().mockResolvedValueOnce([{ memberid: "M1" }, { memberid: "M2" }]);
    await expect(
      resolveContactMessageCustomerHref("sue@example.com", {
        queryFn: ambiguous,
        lookupMemberstack: async () => ({ status: "none" }),
      }),
    ).resolves.toBeNull();

    const unknown = vi.fn().mockResolvedValueOnce([{ memberid: "M1" }]);
    await expect(
      resolveContactMessageCustomerHref("sue@example.com", {
        queryFn: unknown,
        lookupMemberstack: async () => ({ status: "unknown" }),
      }),
    ).resolves.toBeNull();

    const memberstackOnly = vi.fn().mockResolvedValueOnce([]);
    await expect(
      resolveContactMessageCustomerHref("sue@example.com", {
        queryFn: memberstackOnly,
        lookupMemberstack: async () => ({ status: "one", id: "mem_only" }),
      }),
    ).resolves.toBe("/watson/customers/memberstack/mem_only");
  });
});
