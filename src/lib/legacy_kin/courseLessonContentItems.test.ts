import { describe, expect, it } from "vitest";
import course2 from "../../data/legacy_kin/cleaned/course_2_not_enough_needles.poc.json";
import course50 from "../../data/legacy_kin/cleaned/course_50_lk150_quick.poc.json";
import course87 from "../../data/legacy_kin/cleaned/course_87_brother_kh_kr_260_quick_start.poc.json";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";
import {
  contentItemDisplayTitle,
  contentItemNavTitle,
  findLessonContentItemBySlug,
  flattenLessonContent,
  getCourseContentItemNeighbors,
  getLessonContentItemsWithSlugs,
  getLessonContentNavEntries,
  getPublicCourseContentItemNeighbors,
  getPublicLessonContentItems,
  getPublicLessonContentNavEntries,
  groupLessonContentNavEntries,
  resolvePublicLessonItem,
} from "./courseLessonContentItems";
import { isVimeoJumpLinksComponent } from "./vimeoJumpLinksEditor";
import { jumpsFromComponent } from "../kinCourse/vimeoJumpLinks";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";

function previewVimeoId(item: { type: string; component: Record<string, unknown> }): string {
  if (item.type === "video") return String(item.component.vimeoId ?? "");
  const video = item.component.video;
  if (video && typeof video === "object") return String((video as { vimeoId?: unknown }).vimeoId ?? "");
  return "";
}

function findLesson(course: { lessons: CourseLesson[] }, slug: string): CourseLesson {
  const lesson = course.lessons.find((item) => item.slug === slug);
  if (!lesson) throw new Error(`Lesson not found: ${slug}`);
  return lesson;
}

describe("courseLessonContentItems", () => {
  it("assigns stable public slugs for LK-150 lesson 2 sections", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const slugs = getLessonContentItemsWithSlugs(lesson).map((item) => item.itemSlug);

    expect(findLessonContentItemBySlug(lesson, "yarn-and-tension")).toBeDefined();
    expect(findLessonContentItemBySlug(lesson, "needle-positions")).toBeDefined();
    expect(findLessonContentItemBySlug(lesson, "carriage-settings")).toBeDefined();
    expect(slugs).toContain("yarn-and-tension");
    expect(slugs).toContain("needle-positions");
    expect(slugs).toContain("carriage-settings");
  });

  it("sidebar nav includes one link per flattened item", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const nav = getLessonContentNavEntries(lesson);
    const items = flattenLessonContent(lesson);

    expect(nav.length).toBe(items.length);
    expect(nav.every((entry) => entry.itemSlug.length > 0)).toBe(true);
    expect(nav.map((entry) => entry.title)).toContain("Yarn and Tension");
    expect(nav.map((entry) => entry.title)).toContain("Needle Positions");
  });

  it("disambiguates multiple items in the same block", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const coneItems = getLessonContentItemsWithSlugs(lesson).filter(
      (item) => item.blockSlug === "do-you-need-yarn-on-cones",
    );

    expect(coneItems.length).toBeGreaterThan(1);
    expect(new Set(coneItems.map((item) => item.itemSlug)).size).toBe(coneItems.length);
  });

  it("gives shared-id videos in one section distinct targets", () => {
    const course = course87 as CoursePreviewData;
    const lesson = findLesson(course, "casting-on");
    const items = getLessonContentItemsWithSlugs(lesson);
    const thread = items.filter((item) => item.blockSlug === "thread-your-machine");

    expect(thread.map((item) => item.component.vimeoId)).toEqual(["544237400", "547749066"]);
    expect(thread.map((item) => item.legacyComponentId)).toEqual([6510, 6510]);
    expect(thread.map((item) => item.itemSlug)).toEqual([
      "thread-your-machine",
      "thread-your-machine--547749066",
    ]);
    expect(thread.map((item) => contentItemDisplayTitle(lesson, item))).toEqual([
      "Thread your machine",
      "Thread your machine",
    ]);
    expect(thread.map((item) => contentItemNavTitle(lesson, item, items))).toEqual([
      "Tension Mast Assembly - Control the yarn",
      "Carriage and yarn feeder(s)",
    ]);
    const threadNav = getPublicLessonContentNavEntries(course, lesson).filter(
      (entry) => entry.blockSlug === "thread-your-machine",
    );
    expect(groupLessonContentNavEntries(threadNav)).toEqual([
      {
        blockSlug: "thread-your-machine",
        sectionTitle: "Thread your machine",
        entries: threadNav,
      },
    ]);

    const first = findLessonContentItemBySlug(lesson, "thread-your-machine");
    const second = findLessonContentItemBySlug(lesson, "thread-your-machine--547749066");
    expect(first?.component.vimeoId).toBe("544237400");
    expect(second?.component.vimeoId).toBe("547749066");

    const fromFirst = getCourseContentItemNeighbors(course, lesson.slug, first!.itemSlug);
    expect(fromFirst.next?.item.itemSlug).toBe("thread-your-machine--547749066");
    expect(fromFirst.next?.item.component.vimeoId).toBe("547749066");

    const fromSecond = getCourseContentItemNeighbors(course, lesson.slug, second!.itemSlug);
    expect(fromSecond.prev?.item.itemSlug).toBe("thread-your-machine");
    expect(fromSecond.prev?.item.component.vimeoId).toBe("544237400");
    expect(contentItemDisplayTitle(fromSecond.next!.lesson, fromSecond.next!.item)).toBe(
      "Casting on Stitches",
    );

    const fromCasting = getCourseContentItemNeighbors(
      course,
      lesson.slug,
      fromSecond.next!.item.itemSlug,
    );
    expect(fromCasting.prev?.item.itemSlug).toBe("thread-your-machine--547749066");
  });

  it("shows matched jump links with the video and skips that page in Next", () => {
    const course = course87 as CoursePreviewData;

    const binding = getPublicLessonContentItems(course, findLesson(course, "bind-off"));
    expect(getPublicLessonContentNavEntries(course, findLesson(course, "bind-off")).map((entry) => entry.title)).toEqual([
      "Binding Off",
    ]);
    expect(binding[0]?.component.vimeoId).toBe("527303259");
    expect(jumpsFromComponent(binding[0]?.attachedJumpLinks?.[0])).toHaveLength(4);
    expect(
      contentItemDisplayTitle(
        getPublicCourseContentItemNeighbors(course, "bind-off", binding[0]!.itemSlug).next!.lesson,
        getPublicCourseContentItemNeighbors(course, "bind-off", binding[0]!.itemSlug).next!.item,
      ),
    ).toBe("Cam Buttons");

    const castingLesson = findLesson(course, "casting-on");
    const castingVideo = getPublicLessonContentItems(course, castingLesson).find(
      (item) => previewVimeoId(item) === "653893647",
    )!;
    expect(jumpsFromComponent(castingVideo.attachedJumpLinks?.[0]).map((jump) => [jump.time, jump.title])).toEqual([
      ["00:00:18", "Yarn on cones only? No!"],
      ["00:00:59", "Thread the mast"],
      ["00:01:27", "Mast Tension Dial"],
      ["00:02:16", "Cast on (my method)"],
      ["00:02:31", "Carriage settings (don't skip this)"],
      ["00:04:24", "Use the cast-on comb"],
      ["00:06:01", "Essential knitting tips"],
    ]);
    expect(castingVideo.attachedJumpLinks?.[0]?.legacyComponentId).toBe(6762);
    expect(
      contentItemDisplayTitle(
        getPublicCourseContentItemNeighbors(course, "casting-on", castingVideo.itemSlug).next!.lesson,
        getPublicCourseContentItemNeighbors(course, "casting-on", castingVideo.itemSlug).next!.item,
      ),
    ).toBe("Secure the yarn tail");

    const ribLesson = findLesson(course, "using-your-ribber");
    const english = getPublicLessonContentItems(course, ribLesson).find(
      (item) => previewVimeoId(item) === "151859178",
    )!;
    expect(jumpsFromComponent(english.attachedJumpLinks?.[0])).toHaveLength(10);
    expect(
      contentItemDisplayTitle(
        getPublicCourseContentItemNeighbors(course, "using-your-ribber", english.itemSlug).next!.lesson,
        getPublicCourseContentItemNeighbors(course, "using-your-ribber", english.itemSlug).next!.item,
      ),
    ).toBe("Fisherman Rib");

    const lessons = [...course.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
    const sequence = lessons.flatMap((lesson) =>
      getPublicLessonContentItems(course, lesson).map((item) => ({ lesson, item })),
    );
    expect(sequence.some((step) => isVimeoJumpLinksComponent(step.item.component))).toBe(false);
    expect(sequence.some((step) => step.item.component.legacyType === "DataEntrytextarea")).toBe(false);

    const walked: string[] = [];
    let cursor: (typeof sequence)[number] | null = sequence[0] ?? null;
    while (cursor) {
      walked.push(`${cursor.lesson.slug}/${cursor.item.itemSlug}`);
      const next = getPublicCourseContentItemNeighbors(
        course,
        cursor.lesson.slug,
        cursor.item.itemSlug,
      ).next;
      cursor = next;
    }
    expect(walked).toEqual(sequence.map((step) => `${step.lesson.slug}/${step.item.itemSlug}`));
    expect(walked).toHaveLength(sequence.length);
  });

  it("Course 87 student preview keeps chapters on the video and hides note boxes", () => {
    const course = course87 as CoursePreviewData;

    const posture = getPublicLessonContentItems(course, findLesson(course, "learn-about-the-machine"));
    const postureVideo = posture.find((item) => item.component.vimeoId === "530014000");
    expect(postureVideo?.itemSlug).toBe("the-proper-way-to-knit--6498");

    const casting = getPublicLessonContentItems(course, findLesson(course, "casting-on"));
    const castingVideo = casting.find((item) => item.blockSlug === "casting-on-stitches");
    expect(casting.filter((item) => item.blockSlug === "casting-on-stitches")).toHaveLength(1);
    expect(jumpsFromComponent(castingVideo?.attachedJumpLinks?.[0])).toHaveLength(7);
    expect(casting.map((item) => item.itemSlug)).not.toContain("casting-on-stitches--6762");

    const bindOff = getPublicLessonContentItems(course, findLesson(course, "bind-off"));
    expect(bindOff).toHaveLength(1);
    expect(bindOff[0]?.component.vimeoId).toBe("527303259");
    expect(jumpsFromComponent(bindOff[0]?.attachedJumpLinks?.[0]).map((jump) => jump.title)).toEqual([
      "Manually knit a loose row",
      "Break/cut the working yarn",
      "Pull out all the needles",
      "Pull stitch-through-stitch",
    ]);

    const tuck = getPublicLessonContentItems(course, findLesson(course, "tuck-stitch"));
    expect(tuck.some((item) => item.legacyComponentId === 6782)).toBe(false);
    expect(tuck.some((item) => String(item.component.html ?? "").includes("Cast on and knit a few rows in plain stockinette"))).toBe(true);

    const hiddenChapters = resolvePublicLessonItem(course, findLesson(course, "bind-off"), "binding-off--6759");
    expect(hiddenChapters.redirectSlug).toBe(bindOff[0]?.itemSlug);

    const fromPosture = getPublicCourseContentItemNeighbors(
      course,
      "learn-about-the-machine",
      postureVideo!.itemSlug,
    );
    expect(fromPosture.next?.item.component.vimeoId).not.toBe("53001400");

    const postureNav = getPublicLessonContentNavEntries(
      course,
      findLesson(course, "learn-about-the-machine"),
    );
    const postureGroup = groupLessonContentNavEntries(postureNav).find(
      (group) => group.blockSlug === "the-proper-way-to-knit",
    );
    expect(postureGroup?.sectionTitle).toBe("Arm, hand and wrist position");
    expect(postureGroup?.entries.map((entry) => [entry.itemSlug, entry.title])).toEqual([
      ["the-proper-way-to-knit", "Save your back, neck and shoulders"],
      ["the-proper-way-to-knit--6498", "2 hands!!!"],
      ["the-proper-way-to-knit--6754", "Arm, hand and wrist position"],
      ["the-proper-way-to-knit--6755", "More tips"],
    ]);
  });

  it("labels Course 87 sibling blocks from their own title or heading", () => {
    const course = course87 as CoursePreviewData;
    const typeSuffix = /\((?:Text|Video|Gallery|Pending|Image|Download|Carousel|Accordion|Tool)\)$/;

    for (const lesson of course.lessons) {
      const items = getPublicLessonContentItems(course, lesson);
      const nav = getPublicLessonContentNavEntries(course, lesson);
      expect(nav.map((entry) => entry.itemSlug)).toEqual(items.map((item) => item.itemSlug));

      for (const group of groupLessonContentNavEntries(nav)) {
        if (group.entries.length === 1) {
          expect(group.entries[0]!.title).toBe(group.sectionTitle);
          continue;
        }
        expect(group.entries.every((entry) => entry.sectionTitle === group.sectionTitle)).toBe(true);
        expect(group.entries.some((entry) => typeSuffix.test(entry.title))).toBe(false);
        const labels = group.entries.map((entry) => entry.title);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });

  it("Course 2 Decorative Seams resolves hairpin-lace-seam item slug", () => {
    const lesson = findLesson(course2, "decorative-seams");
    const result = validateLessonForPublicRenderer(lesson);

    expect(result.rendererPassed).toBe(true);
    expect(findLessonContentItemBySlug(lesson, "hairpin-lace-seam")).toBeDefined();
    expect(
      contentItemDisplayTitle(lesson, findLessonContentItemBySlug(lesson, "hairpin-lace-seam")!),
    ).toBe("Hairpin Lace Seam");
  });
});
