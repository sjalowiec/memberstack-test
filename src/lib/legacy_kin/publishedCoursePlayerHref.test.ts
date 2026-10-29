import { describe, expect, it } from "vitest";
import { publishedAvailablePlayerHref } from "./publishedCoursePlayerHref";

describe("publishedAvailablePlayerHref", () => {
  it("sends published available courses to their player even while content is in progress", () => {
    expect(publishedAvailablePlayerHref("master-lk-patterning")).toBe("/courses/34");
    expect(publishedAvailablePlayerHref("lk-150-quick-start")).toBe("/courses/50");
    expect(publishedAvailablePlayerHref("taitexma-th-tr-160-getting-started")).toBe("/courses/86");
    expect(publishedAvailablePlayerHref("brother-kh-kr-260-quick-start")).toBe("/courses/87");
    expect(publishedAvailablePlayerHref("mastering-the-silver-reed-sk840")).toBe("/courses/111");
    expect(
      publishedAvailablePlayerHref("mastering-the-silver-reed-sk840-a-comprehensive-course"),
    ).toBe("/courses/111");
    expect(publishedAvailablePlayerHref("lk-150-fun")).toBe("/courses/51");
  });

  it("leaves unpublished and not-yet-available courses on the named landing", () => {
    expect(publishedAvailablePlayerHref("set-in-sleeve-perfection")).toBeUndefined();
    expect(publishedAvailablePlayerHref("not-enough-needles")).toBeUndefined();
    expect(publishedAvailablePlayerHref("ribber-basic-bootcamp")).toBeUndefined();
    expect(publishedAvailablePlayerHref("beginner-workshop")).toBeUndefined();
    expect(publishedAvailablePlayerHref("not-a-real-course-slug")).toBeUndefined();
    expect(publishedAvailablePlayerHref("34")).toBeUndefined();
  });
});
