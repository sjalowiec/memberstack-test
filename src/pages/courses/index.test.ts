import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "index.astro"), "utf8");

describe("Courses page library notice", () => {
  it("shows a prominent notice above the course cards that more courses are coming", () => {
    expect(pageSource).toContain('class="courses-hero__title">Courses</h1>');
    expect(pageSource).toContain("data-courses-library-notice");
    expect(pageSource).toContain(
      'id="courses-library-notice-heading" class="courses-library-notice__title"',
    );
    expect(pageSource).toContain("More Courses Are Coming");
    expect(pageSource).toContain(
      "We’re currently updating and rebuilding our course library for the new Knit It Now",
    );
    expect(pageSource).toContain(
      "The courses shown below are available now, and additional courses will be",
    );

    const h1Count = pageSource.split("<h1").length - 1;
    expect(h1Count).toBe(1);

    const noticeIdx = pageSource.indexOf("data-courses-library-notice");
    const noticeHeadingIdx = pageSource.indexOf("More Courses Are Coming");
    const firstCatalogIdx = pageSource.indexOf('class="courses-catalog"');
    const firstGridIdx = pageSource.indexOf('class="courses-grid"');

    expect(noticeIdx).toBeGreaterThan(-1);
    expect(noticeHeadingIdx).toBeGreaterThan(noticeIdx);
    expect(firstCatalogIdx).toBeGreaterThan(noticeIdx);
    expect(firstGridIdx).toBeGreaterThan(noticeIdx);

    expect(pageSource).toContain("kbm-intro-callout courses-library-notice");
    expect(pageSource).toMatch(
      /<h2[^>]*id="courses-library-notice-heading"[^>]*>[\s\S]*More Courses Are Coming/,
    );
  });
});
