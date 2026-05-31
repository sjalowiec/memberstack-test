import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  plainTextFromLegacyEbookBrief,
} from "./legacyEbookPlainText";

describe("plainTextFromLegacyEbookBrief", () => {
  it("strips inline tags and keeps readable text", () => {
    expect(
      plainTextFromLegacyEbookBrief(
        "Patterns are written for <b>3 different gauges!</b>"
      )
    ).toBe("Patterns are written for 3 different gauges!");
  });

  it("collapses br tags to spaces", () => {
    expect(
      plainTextFromLegacyEbookBrief(
        "In new ways. <br><br> Traveling cables, <b>and much more!</b>"
      )
    ).toBe("In new ways. Traveling cables, and much more!");
  });

  it("decodes common named entities", () => {
    expect(plainTextFromLegacyEbookBrief("Tom &amp; Jerry &nbsp; rule")).toBe(
      "Tom & Jerry rule"
    );
  });

  it("returns empty string for blank input", () => {
    expect(plainTextFromLegacyEbookBrief("")).toBe("");
    expect(plainTextFromLegacyEbookBrief("   ")).toBe("");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes numeric character references", () => {
    expect(decodeHtmlEntities("it&#8217;s")).toBe("it\u2019s");
  });
});
