import { describe, expect, it } from "vitest";
import { validateTipOfTheWeekInput } from "./validation";

const base = {
  tipId: "taming-the-curl-2026-08",
  title: "Tame the Dreaded Stockinette Curl",
  intro: "Stockinette naturally curls at the edges.",
  videoContentId: "339",
  availableFrom: "2026-08-08",
  availableThrough: "2026-08-14",
  status: "active",
  learnPoints: ["Why stockinette curls", "Six techniques you can use"],
  relatedLinks: [
    {
      type: "video" as const,
      videoId: "456",
      note: "Blocking basics",
    },
  ],
  tryCopy: "Knit a swatch.",
  sueTipCopy: "Don’t judge on the machine.",
};

describe("validateTipOfTheWeekInput", () => {
  it("saves editable wording and preserves learn/related order", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      learnPoints: ["A", "B", "C"],
      relatedLinks: [
        { type: "video", videoId: "784" },
        { type: "link", title: "Two", url: "/glossary/stockinette-stitch" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.learnPoints).toEqual(["A", "B", "C"]);
    expect(result.value.relatedLinks.map((l) => l.type)).toEqual(["video", "link"]);
    expect(result.value.relatedLinks[1]).toMatchObject({
      type: "link",
      title: "Two",
      url: "/glossary/stockinette-stitch",
    });
    expect(result.value.intro).toBe("<p>Stockinette naturally curls at the edges.</p>");
    expect(result.value.tryCopy).toBe("<p>Knit a swatch.</p>");
    expect(result.value.sueTipCopy).toBe("<p>Don’t judge on the machine.</p>");
    expect(result.value.introGlossarySlug).toBe("");
  });

  it("accepts an optional intro glossary slug or phrase without requiring a numeric id", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      introGlossarySlug: "floats",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.introGlossarySlug).toBe("floats");

    const hyphen = validateTipOfTheWeekInput({
      ...base,
      glossaryTooltip: "fair-isle",
    });
    expect(hyphen.ok).toBe(true);
    if (!hyphen.ok) return;
    expect(hyphen.value.introGlossarySlug).toBe("fair-isle");

    const cleared = validateTipOfTheWeekInput({
      ...base,
      introGlossarySlug: "  ",
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.introGlossarySlug).toBe("");
  });

  it("converts plain Try It, Intro, and Sue’s Tip text to safe HTML and strips unsafe markup", () => {
    const plain = validateTipOfTheWeekInput({
      ...base,
      intro: "Line one\n\nLine two",
      tryCopy: "Line one\n\nLine two",
      sueTipCopy: "Line one\n\nLine two",
    });
    expect(plain.ok).toBe(true);
    if (!plain.ok) return;
    expect(plain.value.intro).toBe("<p>Line one</p><p>Line two</p>");
    expect(plain.value.tryCopy).toBe("<p>Line one</p><p>Line two</p>");
    expect(plain.value.sueTipCopy).toBe("<p>Line one</p><p>Line two</p>");

    const rich = validateTipOfTheWeekInput({
      ...base,
      intro:
        '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><p><a href="/glossary">Link</a></p><script>alert(1)</script>',
      tryCopy:
        '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><p><a href="/glossary">Link</a></p><script>alert(1)</script>',
      sueTipCopy:
        '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><p><a href="/glossary">Link</a></p><script>alert(1)</script>',
    });
    expect(rich.ok).toBe(true);
    if (!rich.ok) return;
    for (const html of [rich.value.intro, rich.value.tryCopy, rich.value.sueTipCopy]) {
      expect(html).toContain("<strong>Bold</strong>");
      expect(html).toContain("<em>italic</em>");
      expect(html).toContain("<ul><li>One</li></ul>");
      expect(html).toContain('<a href="/glossary">Link</a>');
      expect(html).not.toContain("<script");
      expect(html).not.toContain("alert");
    }
  });

  it("rejects overlapping scheduled/active ranges", () => {
    const result = validateTipOfTheWeekInput(
      { ...base, status: "scheduled" },
      {
        siblings: [
          {
            id: "other",
            status: "active",
            availableFrom: "2026-08-10",
            availableThrough: "2026-08-20",
          },
        ],
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/overlap/i);
  });

  it("rejects unsafe related destinations", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [{ type: "link", title: "Bad", url: "javascript:alert(1)" }],
    });
    expect(result.ok).toBe(false);
  });

  it("requires {date} in the footer template", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      availabilityFooterTemplate: "Free this week only.",
    });
    expect(result.ok).toBe(false);
  });
});
