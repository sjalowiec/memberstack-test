import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("course lesson rem font size", () => {
  it("lets a 1rem lesson list follow the 18px lesson text instead of Bootstrap's 10px root", () => {
    const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
    expect(layout).toContain("html { font-size: 10px }");
    expect(layout).toContain('.legacy-content ul[style*="font-size:1rem"]');
    expect(layout).toContain("font-size: 1em !important");
    expect(layout).toContain("font-size: 18px");
  });
});
