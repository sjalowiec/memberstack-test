import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  glossaryHeaderRecords,
  headerSearchUrlKey,
  helpHubHeaderRecords,
  mergeHeaderSearchResults,
  searchHeaderCatalog,
  videoHeaderRecords,
} from "./headerSearchCatalog";
import { scorePagefindHit } from "./headerSearchMerge";
import type { HelpHubTipRecord } from "./helpHubPublic";

const videos = [
  {
    content_id: 2173,
    slug: "latch-tool-bind-off",
    title: "Latch Tool Bind Off",
    description: "Use the latch tool for a quick bind off method that creates a chain edge.",
    status: "published",
    access_level: "member",
  },
  {
    content_id: 100,
    title: "Bind off Basics",
    description: "A chain bind off.",
    status: "published",
  },
  {
    content_id: 101,
    title: "Gauge Swatch",
    description: "Measure stitches and rows.",
    status: "published",
  },
  {
    content_id: 102,
    title: "Secret Cast Off",
    description: "Not published.",
    status: "draft",
  },
];

const glossary = [
  {
    glossaryId: 804,
    english: "Bind off / Cast Off",
    active: true,
    example: "Finishing a piece.",
    helpinfo: "See the cast-off entry.",
  },
  {
    glossaryId: 805,
    english: "Cast off / Bind Off",
    active: true,
    alt: "castoff",
    example: "Another term for bind off.",
  },
  {
    glossaryId: 3,
    english: "Hidden bind off",
    active: false,
  },
  {
    glossaryId: 4,
    english: "DAK bind off",
    active: true,
    dak: true,
  },
];

const helpTips: HelpHubTipRecord[] = [
  {
    id: 1001,
    slug: "cut-and-sew-shaping",
    status: "published",
    question: "How do I shape a neckline without losing my lace or tuck pattern?",
    title: "Shape when knitting in pattern with Cut 'n Sew",
    bubbleAnswer: "Use cut and sew to keep the stitch pattern.",
  },
  {
    id: 2,
    slug: "sleeve-direction",
    status: "published",
    question: "Which sleeve direction should I use?",
    title: "Sleeve direction",
    solutionText: "The top-down sleeve uses a bind-off at the cuff.",
  },
  {
    id: 3,
    slug: "draft-cast-off",
    status: "draft",
    active: true,
    question: "How do I cast off a draft?",
    title: "Draft cast off",
  },
];

function catalog() {
  return [
    ...videoHeaderRecords(videos),
    ...glossaryHeaderRecords(glossary),
    ...helpHubHeaderRecords(helpTips),
  ];
}

describe("header search catalog", () => {
  it("keeps published videos, active glossary entries, and published Help Hub tips", () => {
    const records = catalog();
    const urls = records.map((record) => record.url);
    expect(urls).toContain("/videos/2173");
    expect(urls).toContain("/glossary/bind-off-cast-off/");
    expect(urls).toContain("/glossary/cast-off-bind-off/");
    expect(urls).toContain("/help-hub/cut-and-sew-shaping");
    expect(urls.join(" ")).not.toContain("/videos/102");
    expect(urls.join(" ")).not.toContain("hidden-bind-off");
    expect(urls.join(" ")).not.toContain("dak-bind-off");
    expect(urls.join(" ")).not.toContain("draft-cast-off");
  });

  it("matches known titles and ranks a title ahead of a body mention", () => {
    const records = catalog();
    const video = searchHeaderCatalog(records, "Latch Tool Bind Off");
    expect(video[0]).toMatchObject({ url: "/videos/2173", cat: "videos", rank: 4 });

    const glossaryHit = searchHeaderCatalog(records, "Bind off / Cast Off");
    expect(glossaryHit[0]).toMatchObject({ url: "/glossary/bind-off-cast-off/", cat: "glossary", rank: 4 });

    const help = searchHeaderCatalog(records, "shape a neckline without losing my lace");
    expect(help[0]).toMatchObject({
      url: "/help-hub/cut-and-sew-shaping",
      cat: "help",
      title: "How do I shape a neckline without losing my lace or tuck pattern?",
      rank: 4,
    });

    const castOff = searchHeaderCatalog(records, "cast off");
    expect(castOff.map((hit) => hit.url)).toEqual([
      "/glossary/bind-off-cast-off/",
      "/glossary/cast-off-bind-off/",
      "/videos/100",
      "/videos/2173",
      "/help-hub/sleeve-direction",
    ]);
    expect(castOff.find((hit) => hit.url === "/help-hub/sleeve-direction")?.rank).toBeLessThan(3);
    expect(castOff.some((hit) => hit.url === "/videos/101")).toBe(false);
  });

  it("keeps extra words when a synonym stands in for the typed phrase", () => {
    const hits = searchHeaderCatalog(catalog(), "latch tool cast off");
    expect(hits.map((hit) => hit.title)).toEqual(["Latch Tool Bind Off"]);
    expect(searchHeaderCatalog(catalog(), "casting off").some((hit) => hit.title === "Bind off Basics")).toBe(true);
    expect(searchHeaderCatalog(catalog(), "gauge swatch")[0]?.title).toBe("Gauge Swatch");
  });

  it("keeps higher ranks and drops duplicate urls before the 30-result limit", () => {
    const catalogHits = [
      { url: "/videos/2173", title: "Latch Tool Bind Off", rank: 4 },
      { url: "/help-hub/sleeve-direction", title: "Sleeve body", rank: 1 },
      ...Array.from({ length: 14 }, (_, index) => ({
        url: `/glossary/term-${index}/`,
        title: `Term ${index}`,
        rank: 3,
      })),
    ];
    const pagefind = [
      { url: "https://knititnow.com/videos/2173/", title: "Duplicate video", rank: 0 },
      { url: "/reference/ribbing", title: "Ribbing", rank: 0 },
    ];
    const merged = mergeHeaderSearchResults(catalogHits, pagefind, 30);
    expect(merged[0]?.url).toBe("/videos/2173");
    expect(merged.filter((hit) => headerSearchUrlKey(hit.url) === "/videos/2173")).toHaveLength(1);
    expect(merged.filter((hit) => String(hit.url).startsWith("/glossary/term-"))).toHaveLength(14);
    const helpAt = merged.findIndex((hit) => hit.url === "/help-hub/sleeve-direction");
    expect(helpAt).toBeGreaterThan(14);
    expect(merged.some((hit) => hit.url === "/reference/ribbing")).toBe(false);

    const manyTitles = Array.from({ length: 36 }, (_, index) => ({
      url: `/videos/${index}`,
      title: `Bind off ${index}`,
      rank: 3,
    }));
    const withBody = mergeHeaderSearchResults(
      [
        ...manyTitles,
        { url: "/glossary/latch-tool-bind-off/", title: "Latch Tool Bind Off", rank: 3 },
        { url: "/help-hub/slip-stitch", title: "How do I knit Slip Stitch on my LK150?", rank: 1 },
      ],
      [{ url: "/reference/ribbing", title: "Ribbing", rank: 0 }],
      30,
    );
    expect(withBody.some((hit) => hit.url === "/glossary/latch-tool-bind-off/")).toBe(true);
    expect(withBody.some((hit) => hit.url === "/reference/ribbing")).toBe(false);
    expect(withBody.some((hit) => hit.url === "/help-hub/slip-stitch")).toBe(false);
    expect(withBody.every((hit) => (hit.rank ?? 0) >= 3)).toBe(true);
  });

  it("scores a Pagefind title with the same synonym rules as the catalog", () => {
    expect(scorePagefindHit("cast off", "Casting On and Binding Off", "")).toBe(3);
    expect(scorePagefindHit("latch tool cast off", "Latch Tool Bind Off", "")).toBe(3);
    expect(scorePagefindHit("latch tool cast off", "Machine Knitter's Bookshelf", "A list of knitting books.")).toBe(0);
    expect(scorePagefindHit("gauge calculator", "Gauge Calculator", "")).toBe(4);
  });

  it("wires the header to the live catalog without dropping Pagefind or zero-result tracking", () => {
    const header = readFileSync(new URL("../components/Header.astro", import.meta.url), "utf8");
    expect(header).toContain("/api/header-search?q=");
    expect(header).toContain("__kinMergeHeaderSearch");
    expect(header).toContain('from "../lib/headerSearchMerge"');
    expect(header).not.toContain('from "../lib/headerSearchCatalog"');
    expect(header).toContain("noteGlobalSearchCommit(term, 0)");
    expect(header).toContain("noteGlobalSearchCommit(term, allResults.length)");
    expect(header).toContain("kin-result__type");
    expect(header).toContain("pagefindMatchRank");
    expect(header).toContain("__kinScorePagefindHit");
    const unavailable = header.slice(header.indexOf("function showUnavailable"), header.indexOf("async function getPagefind"));
    expect(unavailable).not.toContain("noteGlobalSearchCommit");
  });
});
