import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  formatMemberNotesDate,
  insertMemberNotesDate,
  MEMBER_NOTES_MAX_LENGTH,
  memberNotesFeedbackAfterLoad,
  memberNotesFeedbackAfterSave,
  memberNotesFromProject,
  normalizeMemberNotes,
  readSavedPatternMemberNotesTarget,
  resolveSavedPatternMemberNotesTarget,
  savedPatternHasMemberNotes,
} from "./savedPatternMemberNotes";

const emptyIds = { hat: "", socks: "", stocking: "", sweater: "" };

describe("saved pattern My Notes", () => {
  it("uses the same length limit as the saved-project store", () => {
    const server = readFileSync(
      resolve("netlify/functions/lib/custom-pattern-projects-store.js"),
      "utf8",
    );
    expect(server).toContain(`MEMBER_NOTES_MAX_LENGTH = ${MEMBER_NOTES_MAX_LENGTH}`);
    expect(MEMBER_NOTES_MAX_LENGTH).toBe(8000);
  });

  it("normalizes plain text and treats missing notes as empty", () => {
    expect(normalizeMemberNotes(undefined)).toBe("");
    expect(normalizeMemberNotes(null)).toBe("");
    expect(normalizeMemberNotes("  blue yarn\r\nleft  ")).toBe("blue yarn\nleft");
    expect(memberNotesFromProject(undefined)).toBe("");
    expect(memberNotesFromProject({})).toBe("");
    expect(memberNotesFromProject({ memberNotes: "  Hold evenly.  " })).toBe("Hold evenly.");
    expect(savedPatternHasMemberNotes("   ")).toBe(false);
    expect(savedPatternHasMemberNotes("Hold evenly.")).toBe(true);
  });

  it("picks the saved project for the view, not a different pattern type", () => {
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/sleeveless/pattern/", emptyIds),
    ).toBeNull();
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/sleeveless/beta-pattern/?project=proj-1", {
        ...emptyIds,
        sweater: "sweater-1",
      }),
    ).toBeNull();
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/hat/pattern/", {
        ...emptyIds,
        sweater: "sweater-1",
      }),
    ).toBeNull();
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/hat/pattern/?project=hat-from-url", {
        ...emptyIds,
        hat: "hat-local",
        sweater: "sweater-1",
      }),
    ).toEqual({ projectId: "hat-from-url", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/socks/pattern/", {
        ...emptyIds,
        socks: "sock-1",
        sweater: "sweater-1",
      }),
    ).toEqual({ projectId: "sock-1", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/christmas-stocking/pattern/", {
        ...emptyIds,
        stocking: "stocking-1",
        socks: "sock-1",
      }),
    ).toEqual({ projectId: "stocking-1", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/drop-shoulder/pattern/", {
        ...emptyIds,
        sweater: "drop-1",
      }),
    ).toEqual({ projectId: "drop-1", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/set-in-sleeve/pattern/?project=set-in-9", emptyIds),
    ).toEqual({ projectId: "set-in-9", family: "sleeveless" });
  });

  it("reads the active id for the current saved-pattern page", () => {
    stubLocalStorage();
    localStorage.setItem("kbm_hat_active_project_id", "hat-local");
    localStorage.setItem("kbm_custom_pattern_active_project_id", "sweater-1");
    expect(readSavedPatternMemberNotesTarget("http://localhost/patterns/hat/pattern/")).toEqual({
      projectId: "hat-local",
      family: "sleeveless",
    });
    expect(
      readSavedPatternMemberNotesTarget("http://localhost/patterns/sleeveless/pattern/?project=proj-url"),
    ).toEqual({ projectId: "proj-url", family: "sleeveless" });
  });

  it("loads existing notes and shows an empty editor when a pattern has none", () => {
    expect(
      memberNotesFeedbackAfterLoad({
        draft: "",
        previousStored: null,
        result: { ok: true, notes: "Use cotton DK" },
      }),
    ).toMatchObject({ draft: "Use cotton DK", stored: "Use cotton DK", canSave: true, message: "" });

    expect(
      memberNotesFeedbackAfterLoad({
        draft: "",
        previousStored: null,
        result: { ok: true, notes: "" },
      }),
    ).toMatchObject({ draft: "", stored: "", canSave: true });
  });

  it("keeps the draft when loading or saving fails", () => {
    const failedLoad = memberNotesFeedbackAfterLoad({
      draft: "typed before the error",
      previousStored: null,
      result: { ok: false, error: "Sign in to save Custom Pattern projects." },
    });
    expect(failedLoad.draft).toBe("typed before the error");
    expect(failedLoad.canSave).toBe(false);
    expect(failedLoad.message).toMatch(/Sign in/);
    expect(failedLoad.message).toMatch(/Save stays off/);

    const failedSave = memberNotesFeedbackAfterSave({
      draftAtSave: "Blue yarn",
      draftNow: "Blue yarn and a lifeline",
      previousStored: "Blue yarn",
      result: { ok: false, error: "Failed to update project." },
    });
    expect(failedSave.draft).toBe("Blue yarn and a lifeline");
    expect(failedSave.stored).toBe("Blue yarn");
    expect(failedSave.canSave).toBe(true);
    expect(failedSave.tone).toBe("error");
    expect(failedSave.message).toMatch(/Your text is still here/);
  });

  it("saves, clears, and reports success without dropping unsaved typing", () => {
    expect(
      memberNotesFeedbackAfterSave({
        draftAtSave: "  Blue yarn  ",
        draftNow: "  Blue yarn  ",
        previousStored: "",
        result: { ok: true, notes: "Blue yarn" },
      }),
    ).toMatchObject({ draft: "Blue yarn", stored: "Blue yarn", message: "Saved.", tone: "saved" });

    expect(
      memberNotesFeedbackAfterSave({
        draftAtSave: "",
        draftNow: "",
        previousStored: "Blue yarn",
        result: { ok: true, notes: "" },
      }),
    ).toMatchObject({ draft: "", stored: "", message: "Saved." });
    expect(savedPatternHasMemberNotes("")).toBe(false);

    const keptTyping = memberNotesFeedbackAfterSave({
      draftAtSave: "Blue yarn",
      draftNow: "Blue yarn plus a note",
      previousStored: "",
      result: { ok: true, notes: "Blue yarn" },
    });
    expect(keptTyping.draft).toBe("Blue yarn plus a note");
    expect(keptTyping.stored).toBe("Blue yarn");
    expect(keptTyping.message).toBe("Saved.");
  });

  it("inserts the local date at the selection without passing 8,000 characters", () => {
    expect(formatMemberNotesDate(new Date(2026, 9, 29))).toBe("Oct 29, 2026");
    expect(formatMemberNotesDate(new Date(Number.NaN))).toBe("");

    const inserted = insertMemberNotesDate({
      value: "Yarn before. Yarn after.",
      selectionStart: 12,
      selectionEnd: 12,
      dateText: "Oct 29, 2026",
    });
    expect(inserted.inserted).toBe(true);
    expect(inserted.value).toBe("Yarn before.Oct 29, 2026 Yarn after.");
    expect(inserted.selectionStart).toBe("Yarn before.Oct 29, 2026".length);
    expect(inserted.selectionEnd).toBe(inserted.selectionStart);

    const replaced = insertMemberNotesDate({
      value: "Replace THIS today",
      selectionStart: 8,
      selectionEnd: 12,
      dateText: "Oct 29, 2026",
    });
    expect(replaced.value).toBe("Replace Oct 29, 2026 today");

    const full = "x".repeat(MEMBER_NOTES_MAX_LENGTH);
    const blocked = insertMemberNotesDate({
      value: full,
      selectionStart: full.length,
      selectionEnd: full.length,
      dateText: "Oct 29, 2026",
    });
    expect(blocked.inserted).toBe(false);
    expect(blocked.value).toBe(full);

    const room = "x".repeat(MEMBER_NOTES_MAX_LENGTH - "Oct 29, 2026".length);
    const exact = insertMemberNotesDate({
      value: room,
      selectionStart: room.length,
      selectionEnd: room.length,
      dateText: "Oct 29, 2026",
    });
    expect(exact.inserted).toBe(true);
    expect(exact.value).toHaveLength(MEMBER_NOTES_MAX_LENGTH);
  });

  it("places My Notes in the sticky nav beside Edit Pattern and Print", () => {
    const nav = readFileSync(resolve("src/components/patterns/SavedPatternStickyNav.astro"), "utf8");
    const slot = nav.indexOf("<slot />");
    const notes = nav.indexOf('data-testid="button-my-notes"');
    const print = nav.indexOf('data-testid="button-print"');
    const navEnd = nav.indexOf("</nav>");
    const dialog = nav.indexOf('id="saved-pattern-member-notes-dialog"');
    expect(slot).toBeGreaterThan(-1);
    expect(slot).toBeLessThan(notes);
    expect(notes).toBeLessThan(print);
    expect(print).toBeLessThan(navEnd);
    expect(dialog).toBeGreaterThan(navEnd);
    expect(nav).toContain("My Notes");
    expect(nav).toContain("sleeveless-pattern-edit-action saved-pattern-member-notes-action");
    expect(nav).toContain('aria-haspopup="dialog"');
    expect(nav).toContain('role="dialog"');
    expect(nav).toContain('aria-modal="true"');
    expect(nav).toContain('aria-labelledby="saved-pattern-member-notes-title"');
    expect(nav).toContain('for="saved-pattern-member-notes-input"');
    expect(nav).toContain('maxlength="8000"');
    expect(nav).toContain("data-saved-pattern-member-notes-cancel");
    expect(nav).toContain("data-saved-pattern-member-notes-save");
    expect(nav).toContain("data-saved-pattern-member-notes-insert-date");
    expect(nav).toContain("Insert Date");
    expect(nav).toContain('aria-live="polite"');
    expect(nav).toContain("class=\"saved-pattern-member-notes-dialog no-print\"");

    const css = readFileSync(resolve("src/styles/patterns/sleeveless-pattern-shared.css"), "utf8");
    expect(css).toContain("max-width: calc(100% - 2.4rem)");
    expect(css).toContain("flex-wrap: wrap");
    const notesCss = readFileSync(
      resolve("src/styles/patterns/saved-pattern-member-notes.css"),
      "utf8",
    );
    expect(notesCss).toContain("@media (max-width: 640px)");
    expect(notesCss).toContain("@media print");
    expect(notesCss).toContain("display: none !important");

    const client = readFileSync(resolve("src/lib/patterns/customPatternProjectClient.ts"), "utf8");
    expect(client).toContain("memberNotesOnly: true");
    const script = readFileSync(resolve("src/scripts/savedPatternMemberNotes.ts"), "utf8");
    expect(script).not.toContain("localStorage");
  });
});
