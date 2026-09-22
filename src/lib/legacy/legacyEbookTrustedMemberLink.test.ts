import { describe, expect, it, vi } from "vitest";
import type { LegacyMemberDetailRow } from "../watson/memberDetail";
import {
  resolveTrustedLegacyMemberIdForEbookRecovery,
} from "./legacyEbookTrustedMemberLink";

const LINDA_MEMBERID = "6ECD81B4-B172-04D6-2FDF-9D46FFB6B909";
const LINDA_EMAIL = "texas44@gmail.com";

function member(partial: Partial<LegacyMemberDetailRow>): LegacyMemberDetailRow {
  return {
    memberid: LINDA_MEMBERID,
    fristname: "Linda",
    lastname: "Dawson",
    email: LINDA_EMAIL,
    address: null,
    address2: null,
    city: null,
    state: null,
    postalcode: null,
    country: null,
    birthdayinfo: null,
    datejoined: "2014-01-08",
    subscriptionexpiring: null,
    active: 1,
    betaactive: 0,
    currentsubscriber: 0,
    ...partial,
  };
}

describe("resolveTrustedLegacyMemberIdForEbookRecovery", () => {
  it("prefers a verified stored KIN / legacy member ID when Watson still has that member", async () => {
    const getMemberById = vi.fn().mockResolvedValue(member({}));
    const resolveByEmail = vi.fn();

    await expect(
      resolveTrustedLegacyMemberIdForEbookRecovery(
        {
          email: "other@example.com",
          storedLegacyMemberid: LINDA_MEMBERID,
        },
        { getMemberById, resolveByEmail },
      ),
    ).resolves.toEqual({
      status: "unique",
      memberid: LINDA_MEMBERID,
      source: "stored",
    });
    expect(getMemberById).toHaveBeenCalledWith(LINDA_MEMBERID, expect.anything());
    expect(resolveByEmail).not.toHaveBeenCalled();
  });

  it("ignores a stored email or Memberstack ID and falls back to a unique email match", async () => {
    const getMemberById = vi.fn();
    const resolveByEmail = vi.fn().mockResolvedValue({
      status: "unique",
      member: member({}),
    });

    await expect(
      resolveTrustedLegacyMemberIdForEbookRecovery(
        {
          email: LINDA_EMAIL,
          storedLegacyMemberid: "mem_from_browser",
        },
        { getMemberById, resolveByEmail },
      ),
    ).resolves.toEqual({
      status: "unique",
      memberid: LINDA_MEMBERID,
      source: "email",
    });
    expect(getMemberById).not.toHaveBeenCalled();
  });

  it("falls back to a unique email match when the stored ID is missing from Watson", async () => {
    const getMemberById = vi.fn().mockResolvedValue(null);
    const resolveByEmail = vi.fn().mockResolvedValue({
      status: "unique",
      member: member({}),
    });

    await expect(
      resolveTrustedLegacyMemberIdForEbookRecovery(
        { email: LINDA_EMAIL, storedLegacyMemberid: "MISSING-ID" },
        { getMemberById, resolveByEmail },
      ),
    ).resolves.toEqual({
      status: "unique",
      memberid: LINDA_MEMBERID,
      source: "email",
    });
  });

  it("skips recovery when the email link is missing", async () => {
    await expect(
      resolveTrustedLegacyMemberIdForEbookRecovery(
        { email: LINDA_EMAIL },
        {
          resolveByEmail: async () => ({ status: "none" }),
        },
      ),
    ).resolves.toEqual({ status: "none" });
  });

  it("skips recovery when the email link is ambiguous", async () => {
    await expect(
      resolveTrustedLegacyMemberIdForEbookRecovery(
        { email: "shared@example.com" },
        {
          resolveByEmail: async () => ({
            status: "ambiguous",
            members: [member({ memberid: "A" }), member({ memberid: "B" })],
          }),
        },
      ),
    ).resolves.toEqual({ status: "ambiguous" });
  });
});
