import { describe, expect, it } from "vitest";
import {
  describeRelatedLessonRefs,
  publishedLessonsForPicker,
  relatedLessonIdsForStorage,
} from "../helpHubMemberLesson";
import {
  filterPickerItems,
  pickerStateFromRefs,
  serializeRelatedLessons,
} from "./relatedLessonPicker";

const lessons = [
  { id: 5002, slug: "tuck-on-the-lk150", title: "Tuck on the LK150", status: "published" },
  { id: 5003, slug: "end-needle-slip-lk150", title: "Slip on the LK150", status: "published" },
  { id: 5004, slug: "draft-lesson", title: "Draft Lesson", status: "draft" },
];

describe("Help Hub related lesson picker", () => {
  it("lists published lessons by title with ids as secondary information", () => {
    const items = publishedLessonsForPicker(lessons);
    expect(items.map((l) => l.title)).toEqual(["Slip on the LK150", "Tuck on the LK150"]);
    expect(items.every((item) => typeof item.id === "number")).toBe(true);
    expect(items.some((item) => item.id === 5004)).toBe(false);
  });

  it("allows selecting more than one published lesson and stores numeric ids", () => {
    const state = pickerStateFromRefs([5002, 5003], lessons);
    expect(state.selectedIds).toEqual([5002, 5003]);
    expect(serializeRelatedLessons(state)).toEqual([5002, 5003]);
    expect(relatedLessonIdsForStorage([5002, 5003])).toEqual([5002, 5003]);
  });

  it("marks missing and unpublished references", () => {
    const views = describeRelatedLessonRefs([5002, 5004, 259], lessons);
    expect(views).toEqual([
      expect.objectContaining({ id: 5002, state: "published", title: "Tuck on the LK150" }),
      expect.objectContaining({ id: 5004, state: "unpublished", title: "Draft Lesson" }),
      expect.objectContaining({ ref: 259, state: "missing" }),
    ]);
  });

  it("filters the searchable list by title", () => {
    const items = publishedLessonsForPicker(lessons);
    expect(filterPickerItems(items, "tuck").map((i) => i.id)).toEqual([5002]);
    expect(filterPickerItems(items, "5003").map((i) => i.id)).toEqual([5003]);
  });
});
