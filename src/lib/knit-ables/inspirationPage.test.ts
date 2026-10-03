import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  knitAbleInspirationClosingLines,
  knitAbleInspirationDisclosure,
  knitAbleInspirationLessonContentId,
  knitAbleInspirationLessons,
  knitAbleInspirationSwatches,
} from "./inspirationPage";

const templateSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"),
  "utf8",
);

describe("Knit-able inspiration template", () => {
  it("drops a missing or invalid color palette", () => {
    expect(knitAbleInspirationSwatches(undefined)).toEqual([]);
    expect(
      knitAbleInspirationSwatches({
        label: "Color inspiration",
        colors: [{ color: "red" }, { color: " #abc " }, { color: "#aabbcc", bordered: true }],
      }),
    ).toEqual([
      { color: "#abc", bordered: false },
      { color: "#aabbcc", bordered: true },
    ]);
    expect(templateSource).toContain("paletteSwatches.length > 0");
  });

  it("drops an empty lesson list and an empty affiliate note", () => {
    expect(knitAbleInspirationLessons(undefined)).toBeNull();
    expect(
      knitAbleInspirationLessons({
        heading: "Helpful member lessons",
        accessLabel: "Members",
        items: [],
      }),
    ).toBeNull();
    expect(
      knitAbleInspirationLessons({
        heading: "   ",
        accessLabel: "Members",
        items: [{ title: "Lesson", description: "Watch this.", href: "/videos/1" }],
      }),
    ).toBeNull();
    expect(knitAbleInspirationDisclosure(undefined)).toBe("");
    expect(knitAbleInspirationDisclosure("  ")).toBe("");
    expect(knitAbleInspirationDisclosure(" Affiliate note. ")).toBe("Affiliate note.");
    expect(knitAbleInspirationClosingLines(undefined)).toEqual([]);
    expect(
      knitAbleInspirationClosingLines([{ text: "  " }, { text: "Keep going.", emphasis: true }]),
    ).toEqual([{ text: "Keep going.", emphasis: true }]);
    expect(templateSource).toContain("knitAbleInspirationLessons(content.lessons)");
    expect(templateSource).toContain("knitAbleInspirationDisclosure");
  });

  it("reads the lesson catalog id from the video path", () => {
    expect(knitAbleInspirationLessonContentId("/videos/597")).toBe("597");
    expect(knitAbleInspirationLessonContentId("/videos/442?ref=knit-able")).toBe("442");
    expect(knitAbleInspirationLessonContentId("/lessons/stripes")).toBe("");
  });
});
