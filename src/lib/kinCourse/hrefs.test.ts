import { describe, expect, it } from "vitest";
import { appendSameCoursePreviewQuery, withPreviewQuery } from "./hrefs";

describe("appendSameCoursePreviewQuery", () => {
  const stored =
    '<p><a class="kbm-btn" href="/courses/50/lesson/3470">Review Swatching and Gauge</a></p>';

  it("adds preview=true to a same-course lesson link during draft preview", () => {
    expect(appendSameCoursePreviewQuery(stored, 50, true)).toBe(
      '<p><a class="kbm-btn" href="/courses/50/lesson/3470?preview=true">Review Swatching and Gauge</a></p>',
    );
  });

  it("leaves the stored link unchanged outside preview", () => {
    expect(appendSameCoursePreviewQuery(stored, 50, false)).toBe(stored);
  });

  it("does not add preview to another course", () => {
    const other = '<a href="/courses/51">LK-150 Fun</a>';
    expect(appendSameCoursePreviewQuery(other, 50, true)).toBe(other);
  });

  it("does not duplicate an existing preview query", () => {
    const already = '<a href="/courses/50/lesson/3470?preview=true">Review</a>';
    expect(appendSameCoursePreviewQuery(already, 50, true)).toBe(already);
    expect(withPreviewQuery("/courses/50/lesson/3470?preview=true", true)).toBe(
      "/courses/50/lesson/3470?preview=true",
    );
  });
});
