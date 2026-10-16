import { describe, expect, it } from "vitest";
import { glossaryModalSlugForLink, glossarySlugFromTermHref } from "./glossaryTermModalClient";

describe("glossarySlugFromTermHref", () => {
  it("extracts slug from glossary hrefs", () => {
    expect(glossarySlugFromTermHref("/glossary/back-bed")).toBe("back-bed");
    expect(glossarySlugFromTermHref("/glossary/back-bed/")).toBe("back-bed");
    expect(glossarySlugFromTermHref("/glossary/shaping-notation-knit-it-now?x=1")).toBe(
      "shaping-notation-knit-it-now",
    );
    expect(glossarySlugFromTermHref("/glossary/japanese-notation/")).toBe("japanese-notation");
    expect(glossarySlugFromTermHref("/glossary/japanese-notation-traditional/")).toBe(
      "japanese-notation-traditional",
    );
    expect(glossarySlugFromTermHref("/glossary/needle-pitch")).toBe("needle-pitch");
    expect(glossarySlugFromTermHref("/glossary/needle-pitch/")).toBe("needle-pitch");
    expect(glossaryModalSlugForLink("/glossary/needle-pitch/", { classed: true, inCourse: true })).toBe(
      "needle-pitch",
    );
    expect(glossarySlugFromTermHref("https://www.knititnow.com/glossary/249/ravel-cord/term")).toBe(
      "ravel-cord",
    );
  });

  it("returns null for non-glossary hrefs", () => {
    expect(glossarySlugFromTermHref("/help-hub/foo")).toBeNull();
    expect(glossarySlugFromTermHref("/glossary")).toBeNull();
    expect(glossarySlugFromTermHref("/glossary/")).toBeNull();
    expect(glossarySlugFromTermHref("")).toBeNull();
    expect(glossarySlugFromTermHref("https://example.com/glossary/needle-pitch")).toBeNull();
  });
});

describe("glossaryModalSlugForLink", () => {
  it("opens classed glossary links and course term links, not ordinary links", () => {
    expect(glossaryModalSlugForLink("/glossary/out-of-work-position", { classed: true })).toBe(
      "out-of-work-position",
    );
    expect(glossaryModalSlugForLink("/glossary/wraps-per-inch", { inCourse: true })).toBe(
      "wraps-per-inch",
    );
    expect(glossaryModalSlugForLink("/glossary/wraps-per-inch", {})).toBeNull();
    expect(glossaryModalSlugForLink("/downloads/cast_on_exercises1.pdf", { inCourse: true })).toBeNull();
    expect(glossaryModalSlugForLink("/glossary", { inCourse: true })).toBeNull();
  });
});
