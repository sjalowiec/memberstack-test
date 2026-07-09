import { describe, expect, it } from "vitest";

import {
  buildNotesCollapsedPreview,
  hashRequestsNotesEditing,
  NOTES_COLLAPSED_PREVIEW_MAX_LENGTH,
  resolveNotesDefaultExpanded,
} from "./sleevelessPatternNotesCollapse";

describe("resolveNotesDefaultExpanded", () => {
  it("collapses by default when there is no saved note", () => {
    expect(resolveNotesDefaultExpanded("")).toBe(false);
    expect(resolveNotesDefaultExpanded("   \n  ")).toBe(false);
    expect(resolveNotesDefaultExpanded(null)).toBe(false);
    expect(resolveNotesDefaultExpanded(undefined)).toBe(false);
  });

  it("opens when there is existing note text", () => {
    expect(resolveNotesDefaultExpanded("Use 4mm needles")).toBe(true);
  });

  it("opens when deep-linked to notes editing even with no note", () => {
    expect(resolveNotesDefaultExpanded("", { deepLinkToNotes: true })).toBe(true);
    expect(resolveNotesDefaultExpanded("Cascade 220", { deepLinkToNotes: true })).toBe(true);
  });
});

describe("buildNotesCollapsedPreview", () => {
  it("returns an empty preview when there is no note", () => {
    expect(buildNotesCollapsedPreview("")).toBe("");
    expect(buildNotesCollapsedPreview("   ")).toBe("");
    expect(buildNotesCollapsedPreview(null)).toBe("");
  });

  it("collapses whitespace and newlines into a single line", () => {
    expect(buildNotesCollapsedPreview("Yarn:  Cascade\n\nNeedles: 4mm")).toBe(
      "Yarn: Cascade Needles: 4mm",
    );
  });

  it("returns the full note when within the limit", () => {
    expect(buildNotesCollapsedPreview("Short note", 90)).toBe("Short note");
  });

  it("clamps long notes with an ellipsis", () => {
    const long = "a".repeat(200);
    const preview = buildNotesCollapsedPreview(long, 10);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBe(10);
  });

  it("uses a sensible default max length", () => {
    const long = "b".repeat(NOTES_COLLAPSED_PREVIEW_MAX_LENGTH + 50);
    const preview = buildNotesCollapsedPreview(long);
    expect(preview.length).toBe(NOTES_COLLAPSED_PREVIEW_MAX_LENGTH);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("hashRequestsNotesEditing", () => {
  it("matches the notes edit hash with or without leading #", () => {
    expect(hashRequestsNotesEditing("#edit-notes")).toBe(true);
    expect(hashRequestsNotesEditing("edit-notes")).toBe(true);
  });

  it("does not match other hashes", () => {
    expect(hashRequestsNotesEditing("#edit-title")).toBe(false);
    expect(hashRequestsNotesEditing("")).toBe(false);
    expect(hashRequestsNotesEditing(null)).toBe(false);
  });
});
