import { describe, expect, it } from "vitest";
import {
  courseImageLinkAttrs,
  isExternalLinkUrl,
  linkUrlHasContent,
  normalizeLinkUrl,
} from "./courseImageLink";

describe("linkUrlHasContent", () => {
  it("returns false for empty values", () => {
    expect(linkUrlHasContent("")).toBe(false);
    expect(linkUrlHasContent("  ")).toBe(false);
    expect(linkUrlHasContent(null)).toBe(false);
  });

  it("returns true for non-empty values", () => {
    expect(linkUrlHasContent("/patterns/diy-blanket")).toBe(true);
  });
});

describe("normalizeLinkUrl", () => {
  it("trims and returns undefined for blank input", () => {
    expect(normalizeLinkUrl("  ")).toBeUndefined();
    expect(normalizeLinkUrl(undefined)).toBeUndefined();
  });

  it("returns trimmed URL", () => {
    expect(normalizeLinkUrl(" /patterns/diy-blanket ")).toBe("/patterns/diy-blanket");
  });
});

describe("isExternalLinkUrl", () => {
  it("detects http and https links", () => {
    expect(isExternalLinkUrl("http://example.com")).toBe(true);
    expect(isExternalLinkUrl("https://example.com/page")).toBe(true);
  });

  it("treats internal paths as non-external", () => {
    expect(isExternalLinkUrl("/patterns/diy-blanket")).toBe(false);
  });
});

describe("courseImageLinkAttrs", () => {
  it("returns null when no link URL", () => {
    expect(courseImageLinkAttrs("")).toBeNull();
  });

  it("returns href only for internal links", () => {
    expect(courseImageLinkAttrs("/patterns/diy-blanket")).toEqual({
      href: "/patterns/diy-blanket",
    });
  });

  it("adds target and rel for external links", () => {
    expect(courseImageLinkAttrs("https://example.com")).toEqual({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});
