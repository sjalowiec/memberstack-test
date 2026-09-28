import { describe, expect, it } from "vitest";
import { EDITOR_COMPONENT_TYPES, validateLessonForEditor } from "./courseContentEditorSchema";
import { EDITOR_TYPE_META } from "./courseContentEditorTypes";
import { readCourseContentFile } from "./courseContentAdmin";
import {
  isVimeoJumpLinksComponent,
  jumpLinksOwnedByVideo,
  listAfterDeletingVideoWithJumpLinks,
  listAfterDuplicatingVideoWithJumpLinks,
  listAfterMovingVideoWithJumpLinks,
  siblingVimeoFromComponents,
  toNativeVimeoJumpLinksComponent,
  unattachedJumpLinksReason,
  unattachedJumpLinksSummary,
  videoIndexOwningJumpLinks,
  videoJumpLinksOutlineSummary,
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

  it("associates jump links with the preceding video, not an unrelated one", () => {
    const jumps = {
      type: "migrationPending",
      legacyType: "VimeoJumpLinks",
      legacyComponentId: 6759,
      order: 2,
      legacyFields: {
        CHALLENGE_COMPONENTID: "6414",
        LINKTIME_1: "00:00:10",
        LINKTITLE_1: "Manually knit a loose row",
        LINKTIME_2: "00:01:08",
        LINKTITLE_2: "Break/cut the working yarn",
        LINKTIME_3: "00:01:19",
        LINKTITLE_3: "Pull out all the needles",
        LINKTIME_4: "00:01:25",
        LINKTITLE_4: "Pull stitch-through-stitch",
      },
    };
    const first = { type: "video", vimeoId: "111", legacyComponentId: 1, order: 1 };
    const second = { type: "video", vimeoId: "222", legacyComponentId: 2, order: 2 };
    const afterSecond = { ...jumps, order: 3 };
    const twoVideos = [first, second, afterSecond];

    expect(videoIndexOwningJumpLinks(twoVideos, 2)).toBe(1);
    expect(jumpLinksOwnedByVideo(twoVideos, 0)).toEqual([]);
    expect(videoJumpLinksOutlineSummary(second, jumpLinksOwnedByVideo(twoVideos, 1))).toBe(
      "222 · 4 jump links",
    );
    expect(siblingVimeoFromComponents(twoVideos, 6759)).toEqual({
      vimeoId: "222",
      playerComponentId: 2,
    });

    const beforeAnyVideo = [{ ...jumps, order: 1 }, { ...first, order: 2 }];
    expect(videoIndexOwningJumpLinks(beforeAnyVideo, 0)).toBeNull();
    expect(siblingVimeoFromComponents(beforeAnyVideo, 6759)).toEqual({
      vimeoId: "",
      playerComponentId: null,
    });

    const explicitOther = [
      first,
      { ...jumps, order: 2, playerComponentId: 2, vimeoId: "222" },
      second,
    ];
    expect(videoIndexOwningJumpLinks(explicitOther, 1)).toBe(2);
    expect(jumpLinksOwnedByVideo(explicitOther, 0)).toEqual([]);
  });

  it("moves, duplicates, and deletes jump links with their video", () => {
    const components = [
      { type: "richText", legacyComponentId: 10, order: 1 },
      { type: "video", vimeoId: "527303259", legacyComponentId: 20, order: 2 },
      {
        type: "migrationPending",
        legacyType: "VimeoJumpLinks",
        legacyComponentId: 21,
        order: 3,
        legacyFields: { LINKTIME_1: "00:00:10", LINKTITLE_1: "Start" },
      },
      { type: "video", vimeoId: "999", legacyComponentId: 30, order: 4 },
    ];

    const moved = listAfterMovingVideoWithJumpLinks(
      JSON.parse(JSON.stringify(components)),
      20,
      10,
      "richText",
      false,
    );
    expect(moved?.map((component) => component.legacyComponentId)).toEqual([20, 21, 10, 30]);

    let nextId = 100;
    const duplicated = listAfterDuplicatingVideoWithJumpLinks(
      JSON.parse(JSON.stringify(components)),
      20,
      () => {
      nextId += 1;
      return nextId;
    });
    expect(duplicated?.components.map((component) => component.legacyComponentId)).toEqual([
      10, 20, 21, 101, 102, 30,
    ]);
    expect(duplicated?.cloneLegacyComponentId).toBe(101);

    const deleted = listAfterDeletingVideoWithJumpLinks(JSON.parse(JSON.stringify(components)), 20);
    expect(deleted?.map((component) => component.legacyComponentId)).toEqual([10, 30]);
  });

  it("does not attach jump links that have no chapters or no single video", () => {
    const empty = {
      type: "migrationPending",
      legacyType: "VimeoJumpLinks",
      legacyComponentId: 50,
      order: 2,
      legacyFields: {},
    };
    const video = { type: "video", vimeoId: "111", legacyComponentId: 1, order: 1 };
    const afterVideo = [video, empty];
    expect(unattachedJumpLinksReason(afterVideo, 1)).toBe("no-links");
    expect(unattachedJumpLinksSummary("no-links")).toBe("No links");
    expect(jumpLinksOwnedByVideo(afterVideo, 0)).toEqual([]);

    const beforeVideo = [{ ...empty, order: 1 }, { ...video, order: 2 }];
    expect(unattachedJumpLinksReason(beforeVideo, 0)).toBe("no-links-no-video");

    const sharedId = [
      video,
      { ...video, vimeoId: "111", legacyComponentId: 2, order: 2 },
      {
        type: "migrationPending",
        legacyType: "VimeoJumpLinks",
        legacyComponentId: 3,
        order: 3,
        vimeoId: "111",
        legacyFields: { LINKTIME_1: "00:00:01", LINKTITLE_1: "Start" },
      },
    ];
    expect(unattachedJumpLinksReason(sharedId, 2)).toBe("no-matching-video");
    expect(unattachedJumpLinksSummary("no-matching-video")).toBe("No matching video");
    expect(jumpLinksOwnedByVideo(sharedId, 0)).toEqual([]);
    expect(jumpLinksOwnedByVideo(sharedId, 1)).toEqual([]);
  });
});
