import { describe, expect, it } from "vitest";
import { glossarySlugFromTermHref } from "./glossaryTermModalClient";

describe("glossarySlugFromTermHref", () => {
  it("extracts slug from glossary hrefs", () => {
    expect(glossarySlugFromTermHref("/glossary/back-bed")).toBe("back-bed");
    expect(glossarySlugFromTermHref("/glossary/back-bed/")).toBe("back-bed");
    expect(glossarySlugFromTermHref("/glossary/shaping-notation-knit-it-now?x=1")).toBe(
      "shaping-notation-knit-it-now",
    );
  });

  it("returns null for non-glossary hrefs", () => {
    expect(glossarySlugFromTermHref("/help-hub/foo")).toBeNull();
    expect(glossarySlugFromTermHref("")).toBeNull();
  });
});
