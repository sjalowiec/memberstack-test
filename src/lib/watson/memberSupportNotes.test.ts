import { describe, expect, it, vi } from "vitest";

import {
  buildLegacySupportNoteDisplay,
  buildLegacySupportNoteRecordId,
  getMemberLegacySupportNoteCount,
  getMemberLegacySupportNotes,
  getVisibleSupportNoteColumns,
  hasLegacySupportNoteText,
  LEGACY_MEMBER_NOTES_SOURCE,
  MEMBER_LEGACY_SUPPORT_NOTE_COUNT_SQL,
  MEMBER_LEGACY_SUPPORT_NOTES_SQL,
  MEMBER_SUPPORT_NOTE_SORTABLE_COLUMNS,
} from "./memberSupportNotes";

describe("memberSupportNotes", () => {
  const memberId = "6BF5BA26-0096-7785-FBF5-537D6E2461A7";
  const multilineNotes =
    "8-24 having trouble listing in Marketplace.\n5-17 applied gift certificate to yarn purchase\n12-16 Daughter purchased a $30 gift certificate";

  const row = {
    memberid: memberId,
    notes: multilineNotes,
  };

  it("filters legacy notes by memberid on legacy_members", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await getMemberLegacySupportNotes(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_LEGACY_SUPPORT_NOTES_SQL, [memberId]);
    expect(MEMBER_LEGACY_SUPPORT_NOTES_SQL).toContain("FROM legacy_members");
    expect(MEMBER_LEGACY_SUPPORT_NOTES_SQL).toContain("WHERE memberid = $1");
  });

  it("counts legacy note records without loading note text on the detail page", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ note_count: "1" }]);

    const count = await getMemberLegacySupportNoteCount(memberId, queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_LEGACY_SUPPORT_NOTE_COUNT_SQL, [memberId]);
    expect(count).toBe(1);
  });

  it("exposes sortable support note columns for the UI", () => {
    expect(MEMBER_SUPPORT_NOTE_SORTABLE_COLUMNS).toContain("noteRecordId");
    expect(MEMBER_SUPPORT_NOTE_SORTABLE_COLUMNS).toContain("noteText");
  });

  it("preserves the legacy notes field as one imported record without splitting", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([row]);

    const notes = await getMemberLegacySupportNotes(memberId, queryFn);

    expect(notes).toHaveLength(1);
    expect(notes[0]?.noteText).toBe(multilineNotes);
    expect(notes[0]?.noteRecordId).toBe(buildLegacySupportNoteRecordId(memberId));
  });

  it("keeps full note text intact including line breaks", () => {
    const display = buildLegacySupportNoteDisplay(row);
    expect(display.noteText).toContain("\n5-17 applied gift certificate");
    expect(display.noteSource).toBe(LEGACY_MEMBER_NOTES_SOURCE);
  });

  it("handles missing or malformed legacy metadata safely", () => {
    const display = buildLegacySupportNoteDisplay({
      memberid: memberId,
      notes: "   ",
    });

    expect(hasLegacySupportNoteText("   ")).toBe(false);
    expect(display.noteDate).toBeNull();
    expect(display.author).toBeNull();
    expect(display.noteType).toBeNull();
    expect(display.status).toBeNull();
  });

  it("hides optional metadata columns when legacy notes have no dates or authors", () => {
    const visible = getVisibleSupportNoteColumns([buildLegacySupportNoteDisplay(row)]);

    expect(visible.showNoteDate).toBe(false);
    expect(visible.showAuthor).toBe(false);
    expect(visible.showNoteType).toBe(false);
    expect(visible.showStatus).toBe(false);
  });
});
