import { describe, expect, it, vi } from "vitest";

import {
  COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL,
  EXPIRED_COMPLIMENTARY_ACCESS_SQL,
  UPSERT_COMPLIMENTARY_ACCESS_SQL,
  updateComplimentaryAccessThrough,
} from "./complimentaryAccess";

describe("complimentary access storage", () => {
  it("keeps the date on its own table, separate from legacy paid-through", () => {
    expect(COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL).toContain("watson_complimentary_access");
    expect(COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL).not.toContain("subscriptionexpiring");
    expect(UPSERT_COMPLIMENTARY_ACCESS_SQL).toContain("ON CONFLICT (memberstack_id)");
    expect(EXPIRED_COMPLIMENTARY_ACCESS_SQL).toContain("access_through < $1::date");
  });

  it("upserts the date and writes a Membership audit note", async () => {
    const notes: unknown[] = [];
    let stored: string | null = null;
    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === COMPLIMENTARY_ACCESS_BY_MEMBERSTACK_SQL) {
        return stored ? [{ memberstack_id: params?.[0], access_through: stored }] : [];
      }
      if (sql === UPSERT_COMPLIMENTARY_ACCESS_SQL) {
        stored = String(params?.[1]);
        return [{ memberstack_id: params?.[0], access_through: stored }];
      }
      if (sql.includes("INSERT INTO watson_notes")) {
        notes.push(params);
        return [
          {
            id: "note1",
            memberid: params?.[0],
            note_text: params?.[1],
            category: params?.[2],
            created_by: params?.[3],
            created_at: "2026-10-04T00:00:00.000Z",
            updated_at: null,
          },
        ];
      }
      return [];
    });

    const result = await updateComplimentaryAccessThrough({
      memberstackId: "mem_cmutocyhr00ot0txbd9w64exb",
      accessThroughYmd: "2027-01-04",
      updatedBy: "Sue",
      queryFn,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.newAccessThroughYmd).toBe("2027-01-04");
    expect(result.value.oldAccessThroughYmd).toBeNull();
    expect(stored).toBe("2027-01-04");
    expect(notes[0]?.[0]).toBe("mem_cmutocyhr00ot0txbd9w64exb");
    expect(String(notes[0]?.[1])).toContain("2027-01-04");
    expect(notes[0]?.[2]).toBe("Membership");
  });
});
