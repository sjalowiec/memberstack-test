import { describe, expect, it, vi } from "vitest";

import {
  getCustomerWatsonNoteCount,
  getCustomerWatsonNotes,
  WATSON_NOTES_BY_CUSTOMER_SQL,
} from "./watsonNotes";

describe("watsonNotes customer compatibility", () => {
  const memberstackId = "mem_customer_1";
  const legacyMemberId = "M1";

  it("loads notes stored under either Memberstack or legacy member IDs", async () => {
    const queryFn = vi.fn(async () => [
      {
        id: "note-legacy",
        memberid: legacyMemberId,
        note_text: "Legacy-keyed note",
        category: "Support",
        created_by: "Sue",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: null,
      },
      {
        id: "note-memberstack",
        memberid: memberstackId,
        note_text: "Memberstack-keyed note",
        category: "General",
        created_by: "Sue",
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: null,
      },
    ]);

    const notes = await getCustomerWatsonNotes(memberstackId, legacyMemberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(WATSON_NOTES_BY_CUSTOMER_SQL, [
      memberstackId,
      legacyMemberId,
    ]);
    expect(notes).toHaveLength(2);
    expect(notes.map((note) => note.id)).toEqual(["note-legacy", "note-memberstack"]);
  });

  it("counts notes across both identifiers", async () => {
    const queryFn = vi.fn(async () => [{ note_count: "3" }]);
    const count = await getCustomerWatsonNoteCount(memberstackId, legacyMemberId, queryFn);
    expect(count).toBe(3);
  });
});
