import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import {
  addMemberResource,
  combinedMemberResourcePickerItems,
  describeSelectedMemberResources,
  filterMemberResourcePickerItems,
  libraryVideosForPicker,
  memberResourceOptionLabel,
  memberResourcePickerResults,
  moveMemberResource,
  normalizeRelatedLibraryVideos,
  resolveRelatedLibraryVideoCards,
  selectedLessonNumberLabel,
  selectedResourceConfirmation,
  serializeMemberResources,
  selectionDisplayOrder,
  selectionFromStoredResources,
} from "./memberResources";

const VIMEO_1027 = "502818680";

const lessons = [
  { id: 5002, slug: "tuck-on-the-lk150", title: "Tuck on the LK150", status: "published" },
];

describe("Learning Library member resource search", () => {
    const library = libraryVideosForPicker(videosPublic);

  it("finds Learning Library entry 1027 by number", () => {
    const matches = filterMemberResourcePickerItems(library, "1027");
    expect(matches.some((item) => item.id === 1027)).toBe(true);
    expect(matches.find((item) => item.id === 1027)?.title).toBe("Every other Needle Knitting");
  });

  it("finds Learning Library entry 1027 by title", () => {
    const matches = filterMemberResourcePickerItems(library, "Every other Needle Knitting");
    expect(matches.some((item) => item.id === 1027)).toBe(true);
  });

  it("finds a database-only published video and older text content ids", () => {
    const items = libraryVideosForPicker([
      { content_id: "249", title: "Cut and Sew intro", slug: "cut-and-sew-intro" },
      { content_id: "249-1", title: "Cut and Sew clip", slug: "cut-and-sew-clip", status: "published" },
      { content_id: 5004, title: "New catalog video", slug: "new-catalog-video", status: "published" },
      { content_id: 5005, title: "Hidden draft", slug: "hidden-draft", status: "draft" },
    ]);
    expect(items.find((item) => item.id === 249)?.title).toBe("Cut and Sew intro");
    expect(items.find((item) => item.id === "249-1")?.title).toBe("Cut and Sew clip");
    expect(memberResourcePickerResults(items, "5004").map((item) => item.id)).toEqual([5004]);
    expect(memberResourcePickerResults(items, "249-1").map((item) => item.id)).toEqual(["249-1"]);
    expect(items.some((item) => item.id === 5005)).toBe(false);

    const stored = selectionFromStoredResources(
      [],
      [{ type: "library", contentId: 5004 }],
      [],
      items,
    );
    expect(describeSelectedMemberResources(stored, [], items)).toEqual([
      expect.objectContaining({
        source: "library",
        id: 5004,
        title: "New catalog video",
        state: "published",
      }),
    ]);
    expect(normalizeRelatedLibraryVideos(["249-1", { contentId: "249" }, 5004])).toEqual([
      { type: "library", contentId: "249-1" },
      { type: "library", contentId: 249 },
      { type: "library", contentId: 5004 },
    ]);
    const cards = resolveRelatedLibraryVideoCards(
      [{ type: "library", contentId: "249-1" }],
      [{ content_id: "249-1", title: "Cut and Sew clip", status: "published" }],
    );
    expect(cards[0]?.href).toBe("/videos/249-1");
    expect(cards[0]?.title).toBe("Cut and Sew clip");
  });

  it("does not include Vimeo ID 502818680 in picker items", () => {
    const item = library.find((row) => itemId(row) === 1027);
    expect(item).toBeDefined();
    expect(JSON.stringify(item)).not.toContain(VIMEO_1027);
    expect(item).not.toHaveProperty("vimeo_id");
  });
});

function itemId(item: { id: number }): number {
  return item.id;
}

describe("selecting Lesson 1027", () => {
  it("stores catalog content id, not the Vimeo ID", () => {
    const stored = serializeMemberResources({
      lessonIds: [],
      unresolvedLessons: [],
      libraryContentIds: [1027],
    });
    expect(stored.relatedLibraryVideos).toEqual([{ type: "library", contentId: 1027 }]);
    expect(JSON.stringify(stored)).not.toContain(VIMEO_1027);
  });

  it("shows a confirmation that includes the lesson number and title", () => {
    expect(
      selectedResourceConfirmation({
        source: "library",
        id: 1027,
        title: "Every other Needle Knitting",
        slug: "every-other-needle-knitting",
        state: "published",
      }),
    ).toBe("Selected member lesson: 1027 — Every other Needle Knitting");
  });
});

describe("existing member-lesson relationships", () => {
  it("keeps relatedLessons when a library video is also selected", () => {
    const selection = selectionFromStoredResources(
      [5002],
      [{ type: "library", contentId: 1027 }],
      lessons,
      libraryVideosForPicker(videosPublic),
    );
    const stored = serializeMemberResources(selection);
    expect(stored.relatedLessons).toEqual([5002]);
    expect(stored.relatedLibraryVideos).toEqual([{ type: "library", contentId: 1027 }]);
  });
});

describe("normalizeRelatedLibraryVideos", () => {
  it("drops Vimeo fields if a client tries to send them", () => {
    const refs = normalizeRelatedLibraryVideos([
      { type: "library", contentId: 1027, vimeo_id: 502818680, vimeoId: "502818680" },
    ]);
    expect(refs).toEqual([{ type: "library", contentId: 1027 }]);
    expect(JSON.stringify(refs)).not.toContain(VIMEO_1027);
  });
});

describe("resolveRelatedLibraryVideoCards", () => {
  it("links members to /videos/1027 without including the Vimeo ID", () => {
    const cards = resolveRelatedLibraryVideoCards(
      [{ type: "library", contentId: 1027 }],
      videosPublic,
      { tipSlug: "every-other-needle-swatch" },
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.href).toBe("/videos/1027?from=help-hub&hub=every-other-needle-swatch");
    expect(cards[0]?.title).toBe("Every other Needle Knitting");
    expect(JSON.stringify(cards)).not.toContain(VIMEO_1027);
  });
});

describe("combined picker", () => {
  it("includes both Learning Library and Member Lesson sources", () => {
    const items = combinedMemberResourcePickerItems(lessons, [
      { content_id: 1027, title: "Every other Needle Knitting", slug: "every-other-needle-knitting" },
    ]);
    const library = items.find((item) => item.id === 1027);
    const lesson = items.find((item) => item.id === 5002);
    expect(library?.source).toBe("library");
    expect(lesson?.source).toBe("lesson");
  });
});

const BUTTON_LESSON_IDS = [552, 662, 551, 2072, 2071] as const;

describe("multiple related lessons", () => {
  const library = libraryVideosForPicker(videosPublic);

  function lessonItem(id: number) {
    const item = library.find((row) => row.id === id);
    if (!item) throw new Error(`Missing lesson ${id}`);
    return item;
  }

  it("finds lesson 552 by number, title, and URL", () => {
    expect(memberResourcePickerResults(library, "552").some((item) => item.id === 552)).toBe(true);
    expect(
      memberResourcePickerResults(library, "Button Band Finishes").some((item) => item.id === 552),
    ).toBe(true);
    expect(
      memberResourcePickerResults(library, "https://knititnow.com/videos/552").some(
        (item) => item.id === 552,
      ),
    ).toBe(true);
    expect(
      memberResourcePickerResults(library, "/videos/button-band-finishes").some((item) => item.id === 552),
    ).toBe(true);
  });

  it("adds lessons in click order, blocks duplicates, and keeps that order after reload", () => {
    let selection = selectionFromStoredResources([], [], [], library);
    for (const id of BUTTON_LESSON_IDS) {
      const next = addMemberResource(selection, lessonItem(id));
      expect(next).not.toBe(selection);
      selection = next;
      expect(addMemberResource(selection, lessonItem(id))).toBe(selection);
    }
    expect(selectionDisplayOrder(selection).map((ref) => ref.id)).toEqual([...BUTTON_LESSON_IDS]);
    const stored = serializeMemberResources(selection);
    expect(stored.relatedLibraryVideos.map((ref) => ref.contentId)).toEqual([...BUTTON_LESSON_IDS]);
    const reloaded = selectionFromStoredResources(
      stored.relatedLessons,
      stored.relatedLibraryVideos,
      [],
      library,
      stored.memberResourceOrder,
    );
    expect(describeSelectedMemberResources(reloaded, [], library).map((resource) => resource.id)).toEqual([
      ...BUTTON_LESSON_IDS,
    ]);
    expect(selectedLessonNumberLabel({ ...describeSelectedMemberResources(reloaded, [], library)[0]! })).toBe(
      "Lesson 552",
    );
  });

  it("moves a selected lesson and saves the new order", () => {
    let selection = selectionFromStoredResources([], [], [], library);
    for (const id of BUTTON_LESSON_IDS) selection = addMemberResource(selection, lessonItem(id));
    selection = moveMemberResource(selection, 2, -1);
    expect(selectionDisplayOrder(selection).map((ref) => ref.id)).toEqual([552, 551, 662, 2072, 2071]);
    const stored = serializeMemberResources(selection);
    expect(stored.memberResourceOrder.map((ref) => ref.id)).toEqual([552, 551, 662, 2072, 2071]);
  });

  it("keeps an existing single member lesson selected", () => {
    const selection = selectionFromStoredResources([5002], [], lessons, library);
    expect(serializeMemberResources(selection).relatedLessons).toEqual([5002]);
    expect(describeSelectedMemberResources(selection, lessons, library).map((resource) => resource.title)).toEqual([
      "Tuck on the LK150",
    ]);
  });
});

describe("memberResourcePickerResults", () => {
  const library = libraryVideosForPicker(videosPublic);

  it("does not list the catalog until the author types at least 2 characters", () => {
    expect(memberResourcePickerResults(library, "")).toEqual([]);
    expect(memberResourcePickerResults(library, "1")).toEqual([]);
    expect(memberResourcePickerResults(library, "10").length).toBeGreaterThan(0);
  });

  it("limits visible matches to 8", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      source: "library" as const,
      id: 2000 + i,
      title: `Sample lesson ${i}`,
      slug: `sample-lesson-${i}`,
    }));
    expect(memberResourcePickerResults(many, "sample")).toHaveLength(8);
  });

  it("shows 1027 as 1027 — Every other Needle Knitting", () => {
    const matches = memberResourcePickerResults(library, "1027");
    const item = matches.find((row) => row.id === 1027);
    expect(item).toBeDefined();
    expect(memberResourceOptionLabel(item!)).toBe("1027 — Every other Needle Knitting");
  });
});
