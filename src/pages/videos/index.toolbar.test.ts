import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "index.astro"), "utf8");

/** Scoped CSS for `.video-toolbar` only (avoids unrelated sticky/fixed rules on the page). */
function videoToolbarCssBlock(source: string): string {
  const marker = ".video-toolbar {";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const after = source.slice(start);
  const end = after.indexOf("\n    .video-toolbar__inputs");
  expect(end).toBeGreaterThan(-1);
  return after.slice(0, end);
}

describe("Videos catalog filter toolbar", () => {
  it("does not keep the filter panel sticky or fixed while scrolling", () => {
    const toolbarCss = videoToolbarCssBlock(pageSource);
    expect(toolbarCss).not.toMatch(/position:\s*sticky/);
    expect(toolbarCss).not.toMatch(/position:\s*fixed/);
    expect(toolbarCss).toMatch(/position:\s*relative/);
    expect(pageSource).not.toContain('classList.toggle("is-stuck"');
    expect(pageSource).not.toContain(".video-toolbar.is-stuck");
  });

  it("keeps filter controls compact with accessible labels and a search/category row", () => {
    expect(pageSource).toContain('class="video-primary-filters"');
    expect(pageSource).toContain("All Videos");
    expect(pageSource).toContain("Free Videos");
    expect(pageSource).toContain("My Favorites");
    expect(pageSource).toContain('class="video-toolbar__inputs"');

    expect(pageSource).toContain('id="video-filter-search-title" class="sr-only"');
    expect(pageSource).toContain(">Find a Video</label>");
    expect(pageSource).toContain('aria-label="Find a Video"');
    expect(pageSource).not.toMatch(
      /<h2[^>]*id="video-filter-search-title"[^>]*>[\s\S]*Find a Video/,
    );

    expect(pageSource).toContain('id="categoryBrowseTitle"');
    expect(pageSource).toContain('class="video-category__title sr-only"');
    expect(pageSource).toContain("All Categories");
    expect(pageSource).not.toMatch(
      /<span class="video-category__title"(?! sr-only)[^>]*>\s*Category\s*<\/span>/,
    );

    const buttonsIdx = pageSource.indexOf('class="video-primary-filters"');
    const inputsIdx = pageSource.indexOf('class="video-toolbar__inputs"');
    expect(buttonsIdx).toBeGreaterThan(-1);
    expect(inputsIdx).toBeGreaterThan(buttonsIdx);
  });

  it("preserves catalog filter control ids and primary filter values", () => {
    expect(pageSource).toContain('id="videoSearch"');
    expect(pageSource).toContain('id="category-select"');
    expect(pageSource).toContain('id="categoryTrigger"');
    expect(pageSource).toContain('id="categoryMenu"');
    expect(pageSource).toContain('data-filter=""');
    expect(pageSource).toContain('data-filter="__free__"');
    expect(pageSource).toContain('data-filter="__favorites__"');
  });
});
