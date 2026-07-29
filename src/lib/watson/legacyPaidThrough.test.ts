import { describe, expect, it, vi } from "vitest";

import {
  formatLegacyPaidThroughDisplay,
  UPDATE_LEGACY_PAID_THROUGH_SQL,
  updateLegacyPaidThrough,
  validatePaidThroughYmd,
} from "./legacyPaidThrough";
import { MEMBER_DETAIL_SQL } from "./memberDetail";
import type { WatsonQueryFn } from "./memberSearch";

const member = {
  memberid: "M1",
  fristname: "Ada",
  lastname: "Lovelace",
  email: "ada@example.com",
  address: null,
  address2: null,
  city: null,
  state: null,
  postalcode: null,
  country: null,
  birthdayinfo: null,
  datejoined: "2019-05-10T00:00:00.000Z",
  subscriptionexpiring: "2026-07-29",
  active: 1,
  betaactive: 0,
  currentsubscriber: 1,
};

describe("validatePaidThroughYmd", () => {
  it("accepts a real YYYY-MM-DD calendar date", () => {
    expect(validatePaidThroughYmd("2026-08-29")).toEqual({ ok: true, value: "2026-08-29" });
  });

  it("rejects invalid calendar dates and non-YYYY-MM-DD values", () => {
    expect(validatePaidThroughYmd("2026-02-31").ok).toBe(false);
    expect(validatePaidThroughYmd("08/29/2026").ok).toBe(false);
    expect(validatePaidThroughYmd("").ok).toBe(false);
    expect(validatePaidThroughYmd(null).ok).toBe(false);
  });
});

describe("formatLegacyPaidThroughDisplay", () => {
  it("formats the Watson paid-through date without UTC shift", () => {
    expect(formatLegacyPaidThroughDisplay("2026-08-29")).toBe("August 29, 2026");
  });
});

describe("updateLegacyPaidThrough", () => {
  it("updates only subscriptionexpiring with parameterized SQL and writes a Membership audit note", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let current = { ...member };
    const queryFn = (async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql === UPDATE_LEGACY_PAID_THROUGH_SQL) {
        current = { ...current, subscriptionexpiring: String(params[0]) };
        return [];
      }
      if (sql.includes("INSERT INTO watson_notes")) {
        return [
          {
            id: "note-1",
            memberid: "M1",
            note_text: "audit",
            category: "Membership",
            created_by: "Sue",
            created_at: "2026-07-28T00:00:00.000Z",
            updated_at: null,
          },
        ];
      }
      if (sql === MEMBER_DETAIL_SQL) {
        return [current];
      }
      return [];
    }) as unknown as WatsonQueryFn;

    const result = await updateLegacyPaidThrough({
      memberid: "M1",
      paidThroughYmd: "2026-08-29",
      queryFn,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updateCall = calls.find((c) => c.sql === UPDATE_LEGACY_PAID_THROUGH_SQL);
    expect(updateCall?.params).toEqual(["2026-08-29", "M1"]);
    expect(UPDATE_LEGACY_PAID_THROUGH_SQL).toContain("$1::date");
    expect(UPDATE_LEGACY_PAID_THROUGH_SQL).toContain("WHERE memberid = $2");
    expect(UPDATE_LEGACY_PAID_THROUGH_SQL).not.toMatch(/\$\{/);

    expect(result.value.oldPaidThroughYmd).toBe("2026-07-29");
    expect(result.value.newPaidThroughYmd).toBe("2026-08-29");
    expect(result.value.newPaidThroughDisplay).toBe("August 29, 2026");

    const noteCall = calls.find((c) => c.sql.includes("INSERT INTO watson_notes"));
    expect(noteCall?.params[2]).toBe("Membership");
    expect(String(noteCall?.params[1])).toContain("2026-07-29");
    expect(String(noteCall?.params[1])).toContain("2026-08-29");
  });

  it("returns 404 when the member does not exist", async () => {
    const queryFn = vi.fn(async () => []) as unknown as WatsonQueryFn;
    const result = await updateLegacyPaidThrough({
      memberid: "missing",
      paidThroughYmd: "2026-08-29",
      queryFn,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.error).toContain("not found");
  });

  it("does not write Memberstack or other legacy_members columns", async () => {
    const calls: string[] = [];
    let current = { ...member };
    const queryFn = (async (sql: string, params: unknown[] = []) => {
      calls.push(sql);
      if (sql === UPDATE_LEGACY_PAID_THROUGH_SQL) {
        current = { ...current, subscriptionexpiring: String(params[0]) };
        return [];
      }
      if (sql.includes("INSERT INTO watson_notes")) {
        return [
          {
            id: "note-1",
            memberid: "M1",
            note_text: "audit",
            category: "Membership",
            created_by: "Sue",
            created_at: "2026-07-28T00:00:00.000Z",
            updated_at: null,
          },
        ];
      }
      if (sql === MEMBER_DETAIL_SQL) {
        return [current];
      }
      return [];
    }) as unknown as WatsonQueryFn;

    await updateLegacyPaidThrough({
      memberid: "M1",
      paidThroughYmd: "2026-08-29",
      queryFn,
    });

    const updateSql = calls.find((sql) => sql.includes("UPDATE legacy_members"));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain("subscriptionexpiring");
    expect(updateSql).not.toContain("email");
    expect(updateSql).not.toContain("memberstack");
    expect(calls.some((sql) => /memberstack/i.test(sql))).toBe(false);
  });
});
