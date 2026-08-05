import { describe, expect, it } from "vitest";
import {
  filterPublicRelatedLinks,
  normalizeRelatedResource,
  normalizeRelatedResources,
  parseRelatedLinksJson,
  relatedResourceHref,
  tipRelatedVideoHref,
} from "./map";
import { validateTipOfTheWeekInput } from "./validation";

const base = {
  tipId: "taming-the-curl-2026-08",
  title: "Tame the Dreaded Stockinette Curl",
  intro: "Stockinette naturally curls at the edges.",
  videoContentId: "339",
  availableFrom: "2026-08-08",
  availableThrough: "2026-08-14",
  status: "active",
  learnPoints: ["Why stockinette curls"],
  tryCopy: "Knit a swatch.",
  sueTipCopy: "Don’t judge on the machine.",
};

describe("Related Help normalization", () => {
  it("preserves legacy video paths as content_id video resources", () => {
    const resource = normalizeRelatedResource({
      label: "Wet Blocking",
      href: "/videos/456",
      note: "Four reasons to wet block instead of steam",
    });
    expect(resource).toEqual({
      type: "video",
      videoId: "456",
      title: "Wet Blocking",
      note: "Four reasons to wet block instead of steam",
    });
    expect(relatedResourceHref(resource!)).toBe("/videos/456");
  });

  it("preserves legacy glossary/document paths as link resources", () => {
    const resource = normalizeRelatedResource({
      label: "Stockinette Stitch",
      href: "/glossary/stockinette-stitch",
      note: "Glossary: the basic smooth knit fabric",
    });
    expect(resource).toEqual({
      type: "link",
      title: "Stockinette Stitch",
      url: "/glossary/stockinette-stitch",
      note: "Glossary: the basic smooth knit fabric",
    });
  });

  it("parses typed JSON and legacy JSON without losing order or notes", () => {
    const links = parseRelatedLinksJson(
      JSON.stringify([
        {
          type: "video",
          videoId: "784",
          title: "Easy (Lazy) Edge Finish",
          note: "A simple edge finish for slits and openings",
        },
        {
          label: "Wet Blocking",
          href: "/videos/456",
          note: "Four reasons to wet block instead of steam",
        },
        {
          label: "Stockinette Stitch",
          href: "/glossary/stockinette-stitch",
          note: "Glossary: the basic smooth knit fabric",
        },
      ]),
    );
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.type)).toEqual(["video", "video", "link"]);
    expect(links[0]).toMatchObject({
      type: "video",
      videoId: "784",
      note: "A simple edge finish for slits and openings",
    });
    expect(links[1]).toMatchObject({
      type: "video",
      videoId: "456",
      title: "Wet Blocking",
    });
    expect(links[2]).toMatchObject({
      type: "link",
      url: "/glossary/stockinette-stitch",
      note: "Glossary: the basic smooth knit fabric",
    });
  });

  it("builds gated video destinations from content_id", () => {
    expect(tipRelatedVideoHref("456")).toBe("/videos/456");
  });
});

describe("Related Help validation", () => {
  it("looks up video titles from Learning Library content_id", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [{ type: "video", videoId: "456" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relatedLinks).toEqual([
      {
        type: "video",
        videoId: "456",
        title: expect.stringMatching(/\S/),
      },
    ]);
    expect(result.value.relatedLinks[0].type).toBe("video");
    if (result.value.relatedLinks[0].type === "video") {
      expect(result.value.relatedLinks[0].title.toLowerCase()).toContain("block");
    }
  });

  it("rejects invalid related video content IDs", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [{ type: "video", videoId: "999999999" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/No Learning Library video found/i);
  });

  it("accepts manual links, internal documents, and https URLs", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [
        {
          type: "link",
          title: "Glossary",
          url: "/glossary/stockinette-stitch",
        },
        {
          type: "link",
          title: "PDF handout",
          url: "/downloads/curl-tips.pdf",
        },
        {
          type: "link",
          title: "External article",
          url: "https://knititnow.com/blog/example",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relatedLinks).toEqual([
      {
        type: "link",
        title: "Glossary",
        url: "/glossary/stockinette-stitch",
      },
      {
        type: "link",
        title: "PDF handout",
        url: "/downloads/curl-tips.pdf",
      },
      {
        type: "link",
        title: "External article",
        url: "https://knititnow.com/blog/example",
      },
    ]);
  });

  it("preserves multiple resources and order", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [
        { type: "video", videoId: "784" },
        { type: "link", title: "Two", url: "/glossary/stockinette-stitch" },
        { type: "video", videoId: "456", note: "Blocking basics" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relatedLinks.map((l) => l.type)).toEqual([
      "video",
      "link",
      "video",
    ]);
    expect(result.value.relatedLinks[2]).toMatchObject({
      type: "video",
      videoId: "456",
      note: "Blocking basics",
    });
  });

  it("accepts legacy related entries for backward compatibility", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [
        {
          label: "Wet Blocking",
          href: "/videos/456",
          note: "Blocking basics",
        },
        {
          label: "Stockinette Stitch",
          href: "/glossary/stockinette-stitch",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relatedLinks).toEqual([
      {
        type: "video",
        videoId: "456",
        title: expect.stringMatching(/\S/),
        note: "Blocking basics",
      },
      {
        type: "link",
        title: "Stockinette Stitch",
        url: "/glossary/stockinette-stitch",
      },
    ]);
  });

  it("rejects unsafe related destinations", () => {
    const result = validateTipOfTheWeekInput({
      ...base,
      relatedLinks: [
        { type: "link", title: "Bad", url: "javascript:alert(1)" },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe("Related Help public filtering", () => {
  it("renders video and link resources with gated video hrefs and external flags", () => {
    const publicLinks = filterPublicRelatedLinks(
      normalizeRelatedResources([
        {
          type: "video",
          videoId: "456",
          title: "Wet Blocking",
          note: "Blocking basics",
        },
        {
          type: "link",
          title: "External",
          url: "https://knititnow.com/help",
        },
        {
          type: "link",
          title: "Todo",
          url: "/path#todo",
        },
      ]),
    );
    expect(publicLinks).toEqual([
      {
        type: "video",
        label: expect.stringMatching(/\S/),
        href: "/videos/456",
        note: "Blocking basics",
        external: false,
      },
      {
        type: "link",
        label: "External",
        href: "https://knititnow.com/help",
        external: true,
      },
    ]);
  });
});
