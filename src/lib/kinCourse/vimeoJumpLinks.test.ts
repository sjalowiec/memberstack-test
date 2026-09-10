import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { COURSE_111_ID } from "../legacy_kin/course111AdminModel";
import { toNativeVimeoJumpLinksComponent } from "../legacy_kin/vimeoJumpLinksEditor";
import { findLesson, flattenLessons, visibleLessonComponents } from "./player";
import { pocToKinCourse } from "./pocToKinCourse";
import { readKinCoursePresentation } from "./presentation";
import {
  jumpSeconds,
  lessonVimeoPlayerComponents,
  prepareVimeoJumpLinkPlayback,
  type VimeoJump,
} from "./vimeoJumpLinks";
import type { KinCourseComponent } from "./types";

const COURSE_86_LESSON_4212_JUMPS: VimeoJump[] = [
  { time: "00:00:12", title: "The term Mid-Gauge?" },
  { time: "00:00:35", title: "The Needlebed" },
  { time: "00:01:00", title: "The Carriage" },
  { time: "00:01:05", title: "Packed in the Cover" },
  { time: "00:01:45", title: "Critical:  The Table" },
  { time: "00:02:12", title: "Secure the machine to the table" },
  { time: "00:02:42", title: "The Row Counter" },
  { time: "00:02:59", title: "The Carriage Lock" },
  { time: "00:04:01", title: "Tension Mast" },
  { time: "00:05:25", title: "The Knitting Carriage" },
  { time: "00:06:20", title: "Cast on Comb" },
  { time: "00:06:52", title: "Checklist/Review" },
];

function vimeo(
  componentId: number,
  vimeoId: string,
  order = 1,
): KinCourseComponent {
  return { type: "vimeo", order, componentId, vimeoId };
}

function jumpLinks(
  componentId: number,
  vimeoId: string,
  jumps: VimeoJump[],
  order = 2,
): KinCourseComponent {
  return { type: "vimeoJumpLinks", order, componentId, vimeoId, jumps };
}

describe("Course 86 lesson 4212 Vimeo jump links", () => {
  it("renders one Vimeo player, 12 jump links, and preserved titles/timestamps", () => {
    const poc = readCourseContentFile(86);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const lesson = findLesson(course, 4212);
    expect(lesson).toBeTruthy();
    const visible = visibleLessonComponents(lesson!, []);
    const players = lessonVimeoPlayerComponents(visible);
    const jump = visible.find((component) => component.type === "vimeoJumpLinks");

    expect(players).toHaveLength(1);
    expect(players[0]?.vimeoId).toBe("526615684");
    expect(players[0]?.componentId).toBe(6400);
    expect(jump?.embedPlayer).toBe(false);
    expect(jump?.playerComponentId).toBe(6400);
    expect(jump?.playerKey).toBe("6400");
    expect(jump?.jumps).toEqual(COURSE_86_LESSON_4212_JUMPS);
    expect(jumpSeconds(jump?.jumps?.[0]?.time)).toBe(12);
    expect(jumpSeconds("00:06:52")).toBe(6 * 60 + 52);
  });

  it("keeps the recovered pending/legacyFields structure working until admin normalizes it", () => {
    const poc = readCourseContentFile(86);
    const block = poc.lessons[0]?.blocks[0];
    const pending = block?.components.find(
      (component) => component.type === "migrationPending",
    );
    expect(pending?.type).toBe("migrationPending");
    expect(pending && "legacyType" in pending ? pending.legacyType : "").toBe("VimeoJumpLinks");
    expect(pending && "legacyFields" in pending ? pending.legacyFields?.LINKTITLE_12 : "").toBe(
      "Checklist/Review",
    );
  });

  it("maps admin-normalized native vimeoJumpLinks without losing chapters", () => {
    const poc = JSON.parse(JSON.stringify(readCourseContentFile(86))) as ReturnType<
      typeof readCourseContentFile
    >;
    const block = poc.lessons[0]!.blocks[0]!;
    const pending = block.components.find(
      (component) => component.type === "migrationPending",
    ) as Record<string, unknown>;
    const native = toNativeVimeoJumpLinksComponent(pending, {
      vimeoId: "526615684",
      playerComponentId: 6400,
    });
    const index = block.components.findIndex(
      (component) => component.legacyComponentId === pending.legacyComponentId,
    );
    block.components[index] = native;

    const course = pocToKinCourse(poc, { includeDrafts: true });
    const jump = findLesson(course, 4212)?.components.find(
      (component) => component.type === "vimeoJumpLinks",
    );
    expect(jump?.jumps).toEqual(COURSE_86_LESSON_4212_JUMPS);
    expect(jump?.embedPlayer).toBe(false);
    expect(jump?.playerComponentId).toBe(6400);
    expect(native.legacyFields?.LINKTIME_1).toBe("00:00:12");
    expect(native.legacyFields?.LINKTITLE_12).toBe("Checklist/Review");
  });
});

describe("prepareVimeoJumpLinkPlayback", () => {
  it("suppresses a duplicate Vimeo component only when it is the same video as the jump links", () => {
    const same = prepareVimeoJumpLinkPlayback([
      vimeo(1, "111"),
      jumpLinks(2, "111", [{ time: "00:00:10", title: "Start" }]),
      vimeo(3, "111", 3),
      vimeo(4, "222", 4),
    ]);

    expect(lessonVimeoPlayerComponents(same).map((component) => component.vimeoId)).toEqual([
      "111",
      "222",
    ]);
    expect(same.filter((component) => component.type === "vimeo")).toHaveLength(2);
    expect(same.find((component) => component.componentId === 3)).toBeUndefined();
    expect(same.find((component) => component.componentId === 4)?.vimeoId).toBe("222");
    expect(same.find((component) => component.type === "vimeoJumpLinks")?.embedPlayer).toBe(false);
  });

  it("does not suppress duplicate Vimeo components when jump links are not present", () => {
    const videos = prepareVimeoJumpLinkPlayback([vimeo(1, "111"), vimeo(2, "111", 2)]);
    expect(videos.filter((component) => component.type === "vimeo")).toHaveLength(2);
  });

  it("embeds a player on jump links only when the lesson has no matching Vimeo component", () => {
    const standalone = prepareVimeoJumpLinkPlayback([
      jumpLinks(8, "999", [{ time: "00:00:05", title: "Intro" }]),
    ]);
    const jump = standalone.find((component) => component.type === "vimeoJumpLinks");
    expect(jump?.embedPlayer).toBe(true);
    expect(jump?.playerKey).toBe("8");
    expect(lessonVimeoPlayerComponents(standalone)).toHaveLength(1);
  });
});

describe("Course 111 Vimeo playback is unchanged", () => {
  it("still hides Course 111 jump links for lesson 6102 and keeps ordinary Vimeo components", () => {
    const poc = readCourseContentFile(COURSE_111_ID);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const presentation = readKinCoursePresentation(COURSE_111_ID);
    const lesson6102 = findLesson(course, 6102);
    expect(lesson6102).toBeTruthy();
    const visible = visibleLessonComponents(lesson6102!, presentation.hideComponents);
    expect(visible.some((component) => component.type === "vimeoJumpLinks")).toBe(false);

    const videos = flattenLessons(course).flatMap((lesson) =>
      lesson.components.filter((component) => component.type === "vimeo"),
    );
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((component) => component.vimeoId)).toBe(true);
    expect(
      flattenLessons(course).some((lesson) =>
        lesson.components.some((component) => component.legacyType === "ActivePresenter"),
      ),
    ).toBe(true);
  });
});

describe("jumpSeconds", () => {
  it("parses hh:mm:ss and mm:ss", () => {
    expect(jumpSeconds("00:01:05")).toBe(65);
    expect(jumpSeconds("1:05")).toBe(65);
    expect(jumpSeconds("12")).toBe(12);
    expect(jumpSeconds("nope")).toBeNull();
  });
});
