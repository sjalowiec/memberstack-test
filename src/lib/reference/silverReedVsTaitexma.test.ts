import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_URL,
  META_DESCRIPTION,
  PAGE_H1,
  PAGE_PATH,
  SEO_TITLE,
  buildComparisonRows,
  buildFaqItems,
  buildPageJsonLd,
  getComparisonPageData,
  getShopMachinesByBrand,
  serializePageJsonLd,
} from "./silverReedVsTaitexma";

const pageSource = readFileSync(
  resolve("src/pages/reference/machines/silver-reed-vs-taitexma.astro"),
  "utf8"
);

describe("silverReedVsTaitexma page data", () => {
  it("loads current shop models for both brands from machine data", () => {
    const silverReed = getShopMachinesByBrand("Silver Reed");
    const taitexma = getShopMachinesByBrand("Taitexma");

    expect(silverReed.map((m) => m.model)).toEqual(
      expect.arrayContaining(["LK150", "SK280", "SK840"])
    );
    expect(taitexma.map((m) => m.model)).toEqual(
      expect.arrayContaining(["TH160", "TH260", "TH860"])
    );
  });

  it("builds comparison rows for every required feature", () => {
    const silverReed = getShopMachinesByBrand("Silver Reed");
    const taitexma = getShopMachinesByBrand("Taitexma");
    const rows = buildComparisonRows(silverReed, taitexma);
    const features = rows.map((row) => row.feature);

    expect(features).toEqual([
      "Available new",
      "Standard-gauge models",
      "Mid-gauge models",
      "Bulky models",
      "Electronic option",
      "Punchcard option",
      "Plastic-bed option",
      "Needle-selection method",
      "Ribber availability",
      "Lace capability",
      "Typical ordering considerations",
    ]);
  });

  it("states that Taitexma has no electronic model currently listed for sale", () => {
    const taitexma = getShopMachinesByBrand("Taitexma");
    const rows = buildComparisonRows(getShopMachinesByBrand("Silver Reed"), taitexma);
    const electronicRow = rows.find((row) => row.feature === "Electronic option");
    expect(electronicRow?.taitexma).toMatch(/No electronic model currently listed for sale/i);
  });
});

describe("silverReedVsTaitexma structured data", () => {
  it("serializes valid FAQPage JSON-LD that matches visible FAQ content", () => {
    const { faqItems } = getComparisonPageData();
    const parsed = JSON.parse(serializePageJsonLd(faqItems)) as {
      "@graph": Array<{ "@type": string; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }>;
    };

    const faqNode = parsed["@graph"].find((node) => node["@type"] === "FAQPage");
    expect(faqNode?.mainEntity).toHaveLength(faqItems.length);
    expect(faqNode?.mainEntity?.[0]?.name).toBe(faqItems[0].question);
    expect(faqNode?.mainEntity?.[0]?.acceptedAnswer.text).toBe(faqItems[0].answer);
  });

  it("includes BreadcrumbList and WebPage nodes", () => {
    const faqItems = buildFaqItems(
      getShopMachinesByBrand("Silver Reed"),
      getShopMachinesByBrand("Taitexma")
    );
    const graph = buildPageJsonLd(faqItems)["@graph"];
    const types = graph.map((node) => node["@type"]);

    expect(types).toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList", "FAQPage"]));
  });
});

describe("silver-reed-vs-taitexma reference page", () => {
  it("uses the suggested route, SEO title, and meta description", () => {
    expect(PAGE_PATH).toBe("/reference/machines/silver-reed-vs-taitexma");
    expect(CANONICAL_URL).toBe(`https://knitbymachine.com${PAGE_PATH}`);
    expect(SEO_TITLE).toBe(
      "Silver Reed vs Taitexma Knitting Machines: Models and Differences"
    );
    expect(META_DESCRIPTION).toMatch(/Compare Silver Reed and Taitexma knitting machines/i);
  });

  it("renders one H1 via ReferencePageShell and canonical metadata in the page source", () => {
    expect(pageSource.match(/<h1\b/g)?.length ?? 0).toBe(0);
    expect(pageSource).toContain("title={PAGE_H1}");
    expect(pageSource).toContain('href={CANONICAL_URL}');
    expect(pageSource).toContain('type="application/ld+json"');
  });

  it("links to valid internal routes", () => {
    expect(pageSource).toContain('href="/reference/machines/choose"');
    expect(pageSource).toContain('href="/glossary/needle-pitch"');
    expect(pageSource).toContain('href="/shop/machines"');
    expect(pageSource).toContain('href="/designaknit"');
    expect(pageSource).toContain('href="/contact"');
  });
});
