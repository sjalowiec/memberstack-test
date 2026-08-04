import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "index.astro"), "utf8");

/** First `.video-toolbar { ... }` rule only (not the floating back-to-search button). */
function videoToolbarCssBlock(source: string): string {
  const marker = ".video-toolbar {";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const after = source.slice(start);
  const end = after.indexOf("\n    }");
  expect(end).toBeGreaterThan(-1);
  return after.slice(0, end + "\n    }".length);
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

  it("keeps desktop compact controls with accessible labels only", () => {
    expect(pageSource).toContain('class="video-primary-filters"');
    expect(pageSource).toContain("All Videos");
    expect(pageSource).toContain("Free Videos");
    expect(pageSource).toContain("My Favorites");
    expect(pageSource).toContain('class="video-toolbar__search-row"');
    expect(pageSource).toContain('class="video-toolbar__panel"');

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
  });

  it("collapses mobile filters by default behind an accessible Filters disclosure", () => {
    expect(pageSource).toContain('id="videoFiltersToggle"');
    expect(pageSource).toContain('aria-controls="videoFiltersPanel"');
    expect(pageSource).toContain('aria-expanded="false"');
    expect(pageSource).toMatch(
      /id="videoFiltersPanel"[^>]*class="video-toolbar__panel"[^>]*\bhidden\b/,
    );
    expect(pageSource).toContain("toggleVideoFiltersPanel");
    expect(pageSource).toContain("syncVideoFiltersLayoutForViewport");
    expect(pageSource).toContain("syncVideoSearchPlaceholder");
    expect(pageSource).toContain('placeholder="Search videos."');
    expect(pageSource).toContain("(max-width: 700px)");
  });

  it("adds a floating Back to search control that starts hidden", () => {
    expect(pageSource).toContain('id="videoBackToSearch"');
    expect(pageSource).toContain('id="videoToolbar"');
    expect(pageSource).toContain('aria-label="Back to video search and filters"');
    expect(pageSource).toMatch(
      /id="videoBackToSearch"[\s\S]*?\bhidden\b[\s\S]*?Back to search/,
    );
    expect(pageSource).toContain("IntersectionObserver");
    expect(pageSource).toContain("syncVideoBackToSearchFromIntersection");
    expect(pageSource).toContain("activateVideoBackToSearch");
    expect(pageSource).toContain("prefersReducedMotion");
    expect(pageSource).toContain(".video-back-to-search");
    // Floating button may be fixed; the toolbar itself must not be.
    const toolbarCss = videoToolbarCssBlock(pageSource);
    expect(toolbarCss).toMatch(/position:\s*relative/);
    expect(toolbarCss).not.toMatch(/position:\s*(sticky|fixed)/);
  });

  it("positions Back to search from the measured video grid, not .page-wrap", () => {
    expect(pageSource).toContain("syncVideoBackToSearchDesktopPosition");
    expect(pageSource).toContain("--video-back-to-search-right");
    expect(pageSource).toContain("ResizeObserver");
    expect(pageSource).toMatch(
      /right:\s*var\(--video-back-to-search-right/,
    );
    // Must not reintroduce a guessed 1100px / page-wrap formula for the button.
    expect(pageSource).not.toContain("--video-content-max-width");
    expect(pageSource).not.toMatch(
      /\.video-back-to-search\s*\{[^}]*100vw - var\(--max-content-width/,
    );
    expect(pageSource).not.toMatch(
      /\.video-back-to-search\s*\{[^}]*100vw - var\(--video-content-max-width/,
    );
    // Mobile keeps a simple viewport-edge gutter (unchanged).
    expect(pageSource).toMatch(
      /@media \(max-width: 767\.98px\)\s*\{[\s\S]*?\.video-back-to-search\s*\{[\s\S]*?right:\s*max\(1rem,\s*env\(safe-area-inset-right/,
    );
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
