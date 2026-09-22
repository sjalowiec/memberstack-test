import { describe, expect, it } from "vitest";

import {
  UNLINKED_MEMBERSTACK_GRANT_WARNING,
  findDuplicateActiveGrant,
  grantEbookEntitlement,
  listActiveWatsonEbookCustomerEntitlements,
  listApprovedEbookCatalogForAdmin,
  resolveEbookGrantIdentity,
  revokeEbookEntitlement,
  validateApprovedEbookItemId,
  type WatsonEbookEntitlementRow,
} from "./ebookEntitlements";
import type { WatsonQueryFn } from "./memberSearch";

function createEntitlementStore() {
  const rows: WatsonEbookEntitlementRow[] = [];
  let seq = 1;

  const queryFn: WatsonQueryFn = async (sql, params = []) => {
    if (sql.includes("INSERT INTO watson_ebook_entitlements")) {
      const row: WatsonEbookEntitlementRow = {
        id: `ent_${seq++}`,
        item_id: String(params[0]),
        memberstack_id: (params[1] as string | null) ?? null,
        entitlement_email: String(params[2]),
        legacy_memberid: (params[3] as string | null) ?? null,
        reason: String(params[4]),
        note: (params[5] as string | null) ?? null,
        source_storetransactionid: (params[6] as number | null) ?? null,
        granted_by: String(params[7]),
        granted_at: new Date("2026-09-21T12:00:00.000Z"),
        revoked_by: null,
        revoked_at: null,
      };
      const duplicate = rows.some(
        (existing) =>
          existing.revoked_at == null &&
          existing.item_id === row.item_id &&
          ((row.memberstack_id && existing.memberstack_id === row.memberstack_id) ||
            (!row.memberstack_id &&
              !existing.memberstack_id &&
              existing.entitlement_email === row.entitlement_email)),
      );
      if (duplicate) {
        const error = new Error("duplicate key") as Error & { code?: string };
        error.code = "23505";
        throw error;
      }
      rows.push(row);
      return [row];
    }

    if (sql.includes("SET revoked_at = NOW()")) {
      const row = rows.find((item) => item.id === String(params[0]) && item.revoked_at == null);
      if (!row) return [];
      row.revoked_at = new Date("2026-09-21T13:00:00.000Z");
      row.revoked_by = String(params[1]);
      return [row];
    }

    if (sql.includes("WHERE id = $1")) {
      return rows.filter((item) => item.id === String(params[0]));
    }

    if (sql.includes("revoked_at IS NULL")) {
      const memberstackId = (params[0] as string | null) ?? null;
      const emails = (params[1] as string[] | null) ?? [];
      const legacyMemberid = (params[2] as string | null) ?? null;
      return rows.filter(
        (item) =>
          item.revoked_at == null &&
          ((memberstackId && item.memberstack_id === memberstackId) ||
            (emails.length > 0 && emails.includes(item.entitlement_email)) ||
            (legacyMemberid && item.legacy_memberid === legacyMemberid)),
      );
    }

    return [];
  };

  return { rows, queryFn };
}

const linkedIdentity = resolveEbookGrantIdentity({
  memberstackId: "mem_abc123",
  memberstackEmail: "owner@example.com",
  legacyMemberid: "M1",
  legacyEmail: "owner@example.com",
});

describe("Watson ebook entitlements", () => {
  it("lists exactly the 47 approved catalog titles for admin search", () => {
    const catalog = listApprovedEbookCatalogForAdmin();
    expect(catalog).toHaveLength(47);
    expect(catalog.some((row) => row.itemId === "416")).toBe(true);
    expect(catalog.some((row) => row.itemId === "520")).toBe(false);
  });

  it("rejects an unapproved item ID", () => {
    expect(validateApprovedEbookItemId("520").ok).toBe(false);
    expect(validateApprovedEbookItemId("777").ok).toBe(false);
  });

  it("grants an approved ebook to a Memberstack identity", async () => {
    const { queryFn, rows } = createEntitlementStore();
    const result = await grantEbookEntitlement(
      {
        itemId: "416",
        reason: "verified_legacy_purchase",
        note: "Confirmed 2013 receipt",
        identity: linkedIdentity,
      },
      queryFn,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entitlement.itemId).toBe("416");
    expect(result.entitlement.memberstackId).toBe("mem_abc123");
    expect(result.entitlement.entitlementEmail).toBe("owner@example.com");
    expect(result.appearsInMyDownloads).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.memberstack_id).toBe("mem_abc123");
  });

  it("grants a subscriber bonus and a courtesy replacement", async () => {
    const { queryFn } = createEntitlementStore();
    const bonus = await grantEbookEntitlement(
      { itemId: "589", reason: "subscriber_bonus", identity: linkedIdentity },
      queryFn,
    );
    const courtesy = await grantEbookEntitlement(
      { itemId: "505", reason: "courtesy_replacement", identity: linkedIdentity },
      queryFn,
    );
    expect(bonus.ok).toBe(true);
    expect(courtesy.ok).toBe(true);
    if (!bonus.ok || !courtesy.ok) return;
    expect(bonus.entitlement.reason).toBe("subscriber_bonus");
    expect(courtesy.entitlement.reason).toBe("courtesy_replacement");
  });

  it("rejects granting an unapproved item", async () => {
    const { queryFn } = createEntitlementStore();
    const result = await grantEbookEntitlement(
      { itemId: "520", reason: "manual_correction", identity: linkedIdentity },
      queryFn,
    );
    expect(result).toMatchObject({
      ok: false,
      duplicate: false,
      error: "Only approved redistributable ebooks can be granted.",
    });
  });

  it("prevents duplicate active grants for the same Memberstack ID and item", async () => {
    const { queryFn } = createEntitlementStore();
    await grantEbookEntitlement(
      { itemId: "416", reason: "manual_correction", identity: linkedIdentity },
      queryFn,
    );
    const duplicate = await grantEbookEntitlement(
      { itemId: "416", reason: "courtesy_replacement", identity: linkedIdentity },
      queryFn,
    );
    expect(duplicate).toMatchObject({
      ok: false,
      duplicate: true,
      source: "grant",
    });
  });

  it("treats an existing paid purchase as a duplicate", async () => {
    const { queryFn } = createEntitlementStore();
    const result = await grantEbookEntitlement(
      { itemId: "416", reason: "verified_legacy_purchase", identity: linkedIdentity },
      queryFn,
      { paidItemIds: ["416"] },
    );
    expect(result).toMatchObject({
      ok: false,
      duplicate: true,
      source: "purchase",
      itemId: "416",
    });
  });

  it("soft-revokes a manual grant and keeps the audit row", async () => {
    const { queryFn, rows } = createEntitlementStore();
    const granted = await grantEbookEntitlement(
      { itemId: "416", reason: "manual_correction", identity: linkedIdentity },
      queryFn,
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    const revoked = await revokeEbookEntitlement(granted.entitlement.id, "Sue", queryFn);
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.entitlement.active).toBe(false);
    expect(revoked.entitlement.revokedBy).toBe("Sue");
    expect(rows[0]?.revoked_at).not.toBeNull();
    expect(rows).toHaveLength(1);
  });

  it("still matches a Memberstack-ID grant after the login email changes", async () => {
    const { queryFn } = createEntitlementStore();
    await grantEbookEntitlement(
      { itemId: "416", reason: "manual_correction", identity: linkedIdentity },
      queryFn,
    );

    const entitlements = await listActiveWatsonEbookCustomerEntitlements(
      { memberstackId: "mem_abc123", email: "new-email@example.com" },
      queryFn,
    );
    expect(entitlements.map((row) => row.itemId)).toEqual(["416"]);
  });

  it("falls back to the stored email for an older unlinked grant", async () => {
    const { queryFn } = createEntitlementStore();
    const unlinked = resolveEbookGrantIdentity({
      legacyMemberid: "M1",
      legacyEmail: "legacy-owner@example.com",
    });
    expect(unlinked.memberstackId).toBeNull();
    expect(unlinked.warning).toBe(UNLINKED_MEMBERSTACK_GRANT_WARNING);

    const granted = await grantEbookEntitlement(
      { itemId: "416", reason: "subscriber_bonus", identity: unlinked },
      queryFn,
    );
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    expect(granted.appearsInMyDownloads).toBe(false);

    const entitlements = await listActiveWatsonEbookCustomerEntitlements(
      { memberstackId: "mem_later", email: "legacy-owner@example.com" },
      queryFn,
    );
    expect(entitlements.map((row) => row.itemId)).toEqual(["416"]);
  });

  it("refuses a customer with no Memberstack identity and no verified email", () => {
    const identity = resolveEbookGrantIdentity({
      legacyMemberid: "M1",
      legacyEmail: null,
    });
    expect(identity.refuseReason).toMatch(/unverified or ambiguous email/i);
  });

  it("does not match another customer's grant by Memberstack ID", () => {
    const duplicate = findDuplicateActiveGrant(
      [
        {
          id: "ent_1",
          item_id: "416",
          memberstack_id: "mem_abc123",
          entitlement_email: "owner@example.com",
          legacy_memberid: "M1",
          reason: "manual_correction",
          note: null,
          source_storetransactionid: null,
          granted_by: "Sue",
          granted_at: "2026-09-21T12:00:00.000Z",
          revoked_by: null,
          revoked_at: null,
        },
      ],
      "416",
      { memberstackId: "mem_other", emailKeys: ["other@example.com"] },
    );
    expect(duplicate).toBeNull();
  });
});
