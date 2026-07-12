import { describe, expect, it, vi } from "vitest";

import {
  buildWatsonNoteDisplay,
  createWatsonNote,
  deleteWatsonNote,
  getMemberWatsonNoteCount,
  getMemberWatsonNotes,
  updateWatsonNote,
  validateWatsonNoteAuthor,
  validateWatsonNoteCategory,
  validateWatsonNoteId,
  validateWatsonNoteMemberid,
  validateWatsonNoteText,
  WATSON_NOTE_DEFAULT_AUTHOR,
  WATSON_NOTE_TEXT_MAX_LENGTH,
  WATSON_NOTES_BY_MEMBER_SQL,
} from "./watsonNotes";

describe("watsonNotes validation", () => {
  it("requires non-empty trimmed note text", () => {
    expect(validateWatsonNoteText("  hello  ")).toEqual({ ok: true, value: "hello" });
    expect(validateWatsonNoteText("   ")).toEqual({ ok: false, error: "Note text is required." });
    expect(validateWatsonNoteText(null)).toEqual({ ok: false, error: "Note text is required." });
  });

  it("enforces note text max length", () => {
    const tooLong = "a".repeat(WATSON_NOTE_TEXT_MAX_LENGTH + 1);
    expect(validateWatsonNoteText(tooLong).ok).toBe(false);
  });

  it("accepts only approved categories", () => {
    expect(validateWatsonNoteCategory("Support")).toEqual({ ok: true, value: "Support" });
    expect(validateWatsonNoteCategory("Billing").ok).toBe(false);
  });

  it("defaults created by to Sue", () => {
    expect(validateWatsonNoteAuthor(undefined)).toEqual({
      ok: true,
      value: WATSON_NOTE_DEFAULT_AUTHOR,
    });
    expect(validateWatsonNoteAuthor("  Pat  ")).toEqual({ ok: true, value: "Pat" });
  });

  it("validates member and note ids", () => {
    expect(validateWatsonNoteMemberid(" abc ")).toEqual({ ok: true, value: "abc" });
    expect(validateWatsonNoteMemberid("")).toEqual({ ok: false, error: "Member ID is required." });
    expect(validateWatsonNoteId("note-1")).toEqual({ ok: true, value: "note-1" });
  });
});

describe("watsonNotes queries", () => {
  const memberId = "6BF5BA26-0096-7785-FBF5-537D6E2461A7";
  const row = {
    id: "note-1",
    memberid: memberId,
    note_text: "Called about membership renewal.",
    category: "Membership",
    created_by: "Sue",
    created_at: "2026-07-12T14:30:00.000Z",
    updated_at: null,
  };

  it("loads notes newest first by created_at", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([row]);
    await getMemberWatsonNotes(memberId, queryFn);
    expect(queryFn).toHaveBeenCalledWith(WATSON_NOTES_BY_MEMBER_SQL, [memberId]);
    expect(WATSON_NOTES_BY_MEMBER_SQL).toContain("ORDER BY created_at DESC");
  });

  it("builds display rows with formatted timestamps", () => {
    const display = buildWatsonNoteDisplay(row);
    expect(display.noteText).toBe("Called about membership renewal.");
    expect(display.category).toBe("Membership");
    expect(display.createdBy).toBe("Sue");
    expect(display.createdAtSort).toBe("2026-07-12T14:30:00.000Z");
    expect(display.updatedAt).toBeNull();
  });

  it("creates, updates, and deletes notes", async () => {
    const createQuery = vi.fn().mockResolvedValueOnce([row]);
    const createResult = await createWatsonNote(
      {
        memberid: memberId,
        noteText: " Called about membership renewal. ",
        category: "Membership",
      },
      createQuery,
    );
    expect(createResult.ok).toBe(true);
    expect(createQuery.mock.calls[0]?.[1]).toEqual([
      memberId,
      "Called about membership renewal.",
      "Membership",
      "Sue",
    ]);

    const updatedRow = { ...row, note_text: "Updated note.", updated_at: "2026-07-12T15:00:00.000Z" };
    const getQuery = vi
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([updatedRow]);
    const updateResult = await updateWatsonNote(
      { id: "note-1", noteText: "Updated note." },
      getQuery,
    );
    expect(updateResult.ok).toBe(true);
    if (updateResult.ok) {
      expect(updateResult.value.noteText).toBe("Updated note.");
    }

    const deleteQuery = vi.fn().mockResolvedValueOnce([{ id: "note-1" }]);
    const deleteResult = await deleteWatsonNote("note-1", deleteQuery);
    expect(deleteResult).toEqual({ ok: true, value: { id: "note-1" } });
  });

  it("counts notes per member", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ note_count: "2" }]);
    const count = await getMemberWatsonNoteCount(memberId, queryFn);
    expect(count).toBe(2);
  });
});
