import { describe, expect, it } from "vitest";
import {
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
} from "../customPatternProjectNavigation";
import { resolveSavedPatternMemberNotesTarget } from "../savedPatternMemberNotes";
import { CHILD_THUMB_LENGTH_ASSIGNMENT, THUMB_LENGTH_DEFINITION, THUMB_VALUE_SOURCES } from "./mittenSizingChart";
import { womanSmallExampleDraft } from "./mittenDraft";
import { stubLocalStorage } from "../test/stubLocalStorage";
import { hydrateMittenSavedProject, readMittenActiveProjectId } from "./mittenSavedProject";
import { readMittenDraft } from "./mittenDraft";
import type { CustomPatternProject } from "../customPatternProjectTypes";

const emptyIds = { hat: "", triangleScarf: "", socks: "", stocking: "", sweater: "", mittens: "" };

describe("mitten saved pattern routing", () => {
  it("opens and edits on the mitten pages", () => {
    const project = {
      id: "mitten-1",
      pattern: womanSmallExampleDraft(),
      customOverrides: {},
      source: "express" as const,
    };
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/mittens/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      "/patterns/mittens/summary/?edit=1&project=mitten-1",
    );
    expect(getContinueEditingHref("express", project)).toContain("/patterns/mittens/summary/");
    expect(getOpenPatternHrefForProject(project)).not.toContain("/patterns/socks/");
  });

  it("uses the mitten project for My Notes and does not borrow a sweater id", () => {
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/mittens/pattern/?project=mitten-9", {
        ...emptyIds,
        sweater: "sweater-1",
      }),
    ).toEqual({ projectId: "mitten-9", family: "sleeveless" });
    expect(
      resolveSavedPatternMemberNotesTarget("/patterns/mittens/pattern/", {
        ...emptyIds,
        mittens: "mitten-local",
        sweater: "sweater-1",
      }),
    ).toEqual({ projectId: "mitten-local", family: "sleeveless" });
  });

  it("reopens a saved mitten into the mitten draft", () => {
    stubLocalStorage();
    const draft = womanSmallExampleDraft();
    const project = {
      id: "mitten-2",
      name: "Blue mittens",
      notes: "Use the blue yarn.",
      family: "sleeveless",
      source: "express",
      pattern: draft,
      customOverrides: {},
      version: 1,
      createdAt: "",
      updatedAt: "",
    } as CustomPatternProject;
    const restored = hydrateMittenSavedProject(project);
    expect(restored?.thumbLength).toBe(draft.thumbLength);
    expect(restored?.patternProject?.title).toBe("Blue mittens");
    expect(readMittenDraft()?.handCircumference).toBe("7");
    expect(readMittenActiveProjectId()).toBe("mitten-2");
  });

  it("keeps thumb length editable from the approved adult defaults", () => {
    expect(THUMB_LENGTH_DEFINITION).toContain("web to the thumb tip");
    expect(THUMB_VALUE_SOURCES).toContain("2.4");
    expect(THUMB_VALUE_SOURCES).toContain("2.6");
    expect(THUMB_VALUE_SOURCES).toContain(CHILD_THUMB_LENGTH_ASSIGNMENT);
    expect(THUMB_VALUE_SOURCES).toContain("still need to be checked");
    expect(womanSmallExampleDraft().thumbLength).toBe("2.4");
    expect(womanSmallExampleDraft().thumbStyle).toBe("slotted");
  });
});
