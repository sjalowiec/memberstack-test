import { describe, expect, it } from "vitest";
import { EDITOR_COMPONENT_TYPES, validateLessonForEditor } from "./courseContentEditorSchema";
import { EDITOR_TYPE_META } from "./courseContentEditorTypes";
import { readCourseContentFile } from "./courseContentAdmin";
import {
  isVimeoJumpLinksComponent,
  toNativeVimeoJumpLinksComponent,
  vimeoJumpLinksSummary,
} from "./vimeoJumpLinksEditor";
import { jumpsFromComponent } from "../kinCourse/vimeoJumpLinks";

describe("VimeoJumpLinks admin editor", () => {
  it("opens recovered migrationPending VimeoJumpLinks without treating them as pending", () => {
    const poc = readCourseContentFile(86);
    const pending = poc.lessons[0]!.blocks[0]!.components.find(
      (component) => component.type === "migrationPending",
    ) as Record<string, unknown>;

    expect(isVimeoJumpLinksComponent(pending)).toBe(true);
    expect(EDITOR_TYPE_META.vimeoJumpLinks.label).toBe("Vimeo Jump Links");
    expect(EDITOR_TYPE_META.vimeoJumpLinks.label.toLowerCase()).not.toContain("pending");
    expect(vimeoJumpLinksSummary(pending)).toBe("12 chapters");
    expect(jumpsFromComponent(pending)).toHaveLength(12);
    expect(jumpsFromComponent(pending)[0]).toEqual({
      time: "00:00:12",
      title: "The term Mid-Gauge?",
    });
    expect(jumpsFromComponent(pending)[11]).toEqual({
      time: "00:06:52",
      title: "Checklist/Review",
    });
  });

  it("edits, reorders, and saves a native component without losing chapters", () => {
    const poc = readCourseContentFile(86);
    const pending = poc.lessons[0]!.blocks[0]!.components.find(
      (component) => component.type === "migrationPending",
    ) as Record<string, unknown>;

    const jumps = jumpsFromComponent(pending);
    const reordered = [jumps[11]!, ...jumps.slice(0, 11)].map((jump, index) =>
      index === 0 ? { ...jump, title: "Checklist / review" } : jump,
    );

    const saved = toNativeVimeoJumpLinksComponent(pending, {
      jumps: reordered,
      vimeoId: "526615684",
      playerComponentId: 6400,
    });

    expect(saved.type).toBe("vimeoJumpLinks");
    expect(EDITOR_COMPONENT_TYPES.has(saved.type)).toBe(true);
    expect(saved.jumps).toHaveLength(12);
    expect(saved.jumps[0]).toEqual({ time: "00:06:52", title: "Checklist / review" });
    expect(saved.jumps[1]?.title).toBe("The term Mid-Gauge?");
    expect(saved.legacyFields?.LINKTIME_1).toBe("00:06:52");
    expect(saved.legacyFields?.LINKTITLE_1).toBe("Checklist / review");
    expect(saved.legacyFields?.CHALLENGE_ASSIGNID).toBe("4212");
    expect(saved.legacyFields?.CHALLENGE_COMPONENTID).toBe("6401");
    expect(jumpsFromComponent(saved).map((jump) => jump.title)).toContain(
      "Secure the machine to the table",
    );

    const lesson = JSON.parse(JSON.stringify(poc.lessons[0]));
    lesson.blocks[0].components[1] = saved;
    const validation = validateLessonForEditor(lesson);
    expect(validation.issues.filter((issue) => issue.componentType === "vimeoJumpLinks")).toEqual(
      [],
    );
  });
});
