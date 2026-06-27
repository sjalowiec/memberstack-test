import { describe, expect, it } from "vitest";
import { resolveCourseThumbnail } from "./coursesCatalog";

describe("resolveCourseThumbnail", () => {
  it("prefers course JSON thumbnail over catalog overlay", () => {
    expect(
      resolveCourseThumbnail("lk-150-quick-start", "available", "/images/fallback.jpg"),
    ).toContain("/challenge/images/v2/50/carriage_tension_dial.png");
  });

  it("uses catalog overlay when course JSON has no thumbnail", () => {
    expect(
      resolveCourseThumbnail("not-enough-needles", "in-progress", "/images/overlay.jpg"),
    ).toBe("/images/overlay.jpg");
  });

  it("returns undefined when no thumbnail is configured", () => {
    expect(resolveCourseThumbnail("not-enough-needles", "in-progress")).toBeUndefined();
  });
});
