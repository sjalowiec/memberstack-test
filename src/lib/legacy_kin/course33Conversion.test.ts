import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import course33 from "../../data/legacy_kin/cleaned/course_33_beginner_workshop.poc.json";
import type { CoursePreviewData } from "./coursePreviewPoc";
import {
  contentItemDisplayTitle,
  getPublicCourseContentItemNeighbors,
  getPublicCourseContentItemSequence,
} from "./courseLessonContentItems";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";
import {
  getLegacyCourseBySlug,
  getLegacyCourses,
  legacyCoursePreviewHref,
} from "./legacyCourseLoader";
import { isLegacyCourseDraft, isLegacyCoursePublic } from "./legacyCoursePublication";

const data = course33 as CoursePreviewData;

const LESSON_TITLES = [
  "Introducing .. Your Knitting Machine",
  "Yarns for machine knitting",
  "Helpful, Essential Tips",
  "Cast On Methods",
  "Bind off Methods",
  "Swatching is Not Optional!",
  "How much Yarn do I Need?",
  "Just for Fun",
  "Project: Let's Knit a Hat!",
  "Hems and Ribbing",
  "Reading MK Patterns",
  "Oops",
  "Intro to Patterning",
  "Shaping",
  "Finishing",
] as const;

const LINKED_VIMEO_IDS = [
  "178357401",
  "178357325",
  "527759119",
  "178357376",
  "699191838",
  "699787852",
  "178357365",
  "178357361",
  "317801328",
  "178357352",
  "178357341",
  "178357318",
  "178357304",
  "178357273",
  "178357292",
  "178357264",
  "178357247",
  "178357142",
  "178357106",
  "178357093",
  "178357079",
  "178357062",
  "178357056",
  "178357049",
  "178357042",
  "178357030",
  "178357009",
  "178357019",
  "178356993",
  "178357126",
] as const;

describe("Course 33 Beginner Workshop review conversion", () => {
  it("stays unpublished and out of the public player", () => {
    expect(data.course.legacyChallengeId).toBe(33);
    expect(data.course.title).toBe("Beginner Workshop");
    expect(data.course.slug).toBe("beginner-workshop");
    expect(data.course.status).toBe("draft");
    expect(data.course.published).toBe(false);
    expect(data.course.active).toBe(false);
    expect(data.course.contentStatus).toBe("in_progress");
    expect(isLegacyCourseDraft(data.course)).toBe(true);
    expect(isLegacyCoursePublic(data.course)).toBe(false);
    expect(getLegacyCourses().map((course) => course.slug)).not.toContain("beginner-workshop");
    expect(getLegacyCourseBySlug("beginner-workshop")).toBeUndefined();
    expect(getLegacyCourseBySlug("beginner-workshop", { includeDrafts: true })?.lessons).toHaveLength(
      15,
    );
    expect(legacyCoursePreviewHref("beginner-workshop", null, { includeDraftPreview: true })).toBe(
      "/courses/legacy/beginner-workshop?preview=true",
    );
  });

  it("keeps one hat project in the original sequence", () => {
    expect(data.lessons.map((lesson) => lesson.title)).toEqual([...LESSON_TITLES]);
    expect(data.lessons.filter((lesson) => /hat/i.test(lesson.title))).toHaveLength(1);
    expect(data.lessons.map((lesson) => lesson.displayOrder)).toEqual([
      1, 2, 3, 4, 5, 7, 9, 10, 12, 20, 30, 40, 50, 60, 70,
    ]);
    const project = data.lessons.find((lesson) => lesson.title === "Project: Let's Knit a Hat!");
    expect(project?.displayOrder).toBe(12);
    const html = JSON.stringify(project);
    expect(html).toContain("Create Your Hat Pattern");
    expect(html).toContain('href=\\"/patterns/hat/builder?new=1\\"');
    expect(html).toContain('target=\\"_blank\\"');
    expect(html).not.toContain("/challenge/33/");
  });

  it("links every exported video, including the yarn popup", () => {
    const ids = data.lessons.flatMap((lesson) =>
      lesson.blocks.flatMap((block) =>
        block.components
          .filter((component) => component.type === "video")
          .map((component) => ("vimeoId" in component ? component.vimeoId : "")),
      ),
    );
    expect(ids).toEqual([...LINKED_VIMEO_IDS]);
    expect(JSON.stringify(data)).toContain("Do you need yarn on cones for machine knitting?");
    expect(JSON.stringify(data)).not.toContain("data-vimeoid");
  });

  it("localizes recovered images and keeps missing files visible", () => {
    const serialized = JSON.stringify(data);
    expect(serialized).toContain("/images/course-content/33/dont-practice.gif");
    expect(serialized).not.toContain("/challenge/images/v2/33/");
    expect(existsSync(join(process.cwd(), "public/images/course-content/33/dont-practice.gif"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "public/downloads/cast_on_exercises1.pdf"))).toBe(true);
    expect(serialized).toContain("/images/blog/34/yarn_ribber21.jpg");
    expect(serialized).toContain("/downloads/Machine_Knitting_Abbreviations.pdf");
    expect(serialized).toContain("/downloads/merged1-12.pdf");
    expect(existsSync(join(process.cwd(), "public/downloads/merged1-12.pdf"))).toBe(false);
  });

  it("drops the obsolete hat-project steps and keeps the other lessons", () => {
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('"legacyType":"Pattern"');
    expect(serialized).not.toContain("Double Warm Hat");
    expect(serialized).not.toContain("Shaped Watch Cap");
    expect(serialized).not.toContain("/challenge/33/");
    expect(serialized).not.toContain("ImageUpload");
    expect(serialized).not.toContain("DocumentPattern");
    expect(serialized).toContain("/glossary/needle-pitch");
    expect(serialized).toContain("{First}");
    expect(serialized).toContain("Machine Knit Hems");
  });

  it("renders every lesson in the existing player", () => {
    for (const lesson of data.lessons) {
      const rendered = validateLessonForPublicRenderer(lesson);
      expect(rendered.rendererPassed, lesson.slug).toBe(true);
    }
  });

  it("advances one section at a time without repeating or jumping backward", () => {
    const course = getLegacyCourseBySlug("beginner-workshop", { includeDrafts: true });
    expect(course).toBeTruthy();
    const sequence = getPublicCourseContentItemSequence(course!);
    expect(sequence).toHaveLength(
      data.lessons.reduce((count, lesson) => count + lesson.blocks.length, 0),
    );
    expect(sequence.map((step) => step.lesson.title)).toEqual(
      data.lessons.flatMap((lesson) => lesson.blocks.map(() => lesson.title)),
    );

    for (const lesson of data.lessons) {
      const orders = lesson.blocks.map((block) => block.order);
      expect(new Set(orders).size, lesson.slug).toBe(orders.length);
      const items = sequence.filter((step) => step.lesson.slug === lesson.slug);
      expect(items, lesson.slug).toHaveLength(lesson.blocks.length);
    }

    for (let index = 0; index < sequence.length; index += 1) {
      const step = sequence[index]!;
      const title = contentItemDisplayTitle(step.lesson, step.item);
      if (index > 0) {
        expect(title, `${step.lesson.slug}/${step.item.itemSlug}`).not.toBe(
          contentItemDisplayTitle(sequence[index - 1]!.lesson, sequence[index - 1]!.item),
        );
      }
      const { prev, next } = getPublicCourseContentItemNeighbors(
        course!,
        step.lesson.slug,
        step.item.itemSlug,
      );
      if (index === 0) {
        expect(prev).toBeNull();
      } else {
        expect(prev?.lesson.slug).toBe(sequence[index - 1]!.lesson.slug);
        expect(prev?.item.itemSlug).toBe(sequence[index - 1]!.item.itemSlug);
      }
      if (index === sequence.length - 1) {
        expect(next).toBeNull();
      } else {
        expect(next?.lesson.displayOrder).toBeGreaterThanOrEqual(step.lesson.displayOrder);
        expect(next?.lesson.slug).toBe(sequence[index + 1]!.lesson.slug);
        expect(next?.item.itemSlug).toBe(sequence[index + 1]!.item.itemSlug);
      }
    }

    const playedVideoIds = sequence.flatMap((step) => vimeoIdsInPublicItem(step.item.component));
    expect(playedVideoIds).toEqual([...LINKED_VIMEO_IDS]);
  });
});

function vimeoIdsInPublicItem(component: Record<string, unknown>): string[] {
  if (component.type === "video") return [String(component.vimeoId ?? "")];
  if (component.type === "textVideoLayout") {
    const video = component.video as { vimeoId?: string } | undefined;
    return video?.vimeoId ? [String(video.vimeoId)] : [];
  }
  if (component.type === "twoVideosLayout" || component.type === "threeVideosLayout") {
    const slots = component.slots as Array<{ video?: { vimeoId?: string } }> | undefined;
    return (slots ?? [])
      .map((slot) => String(slot.video?.vimeoId ?? ""))
      .filter((id) => id.length > 0);
  }
  return [];
}
