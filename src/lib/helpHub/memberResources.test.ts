import { describe, expect, it } from "vitest";
import videosPublic from "../../data/videos-public.json";
import {
  combinedMemberResourcePickerItems,
  filterMemberResourcePickerItems,
  libraryVideosForPicker,
  normalizeRelatedLibraryVideos,
  resolveRelatedLibraryVideoCards,
  selectedResourceConfirmation,
  serializeMemberResources,
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
