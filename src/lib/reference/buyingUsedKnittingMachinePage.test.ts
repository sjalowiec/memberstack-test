import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve("src/pages/reference/buying-a-used-knitting-machine.astro"),
  "utf8",
);
const referenceIndexSource = readFileSync(resolve("src/pages/reference/index.astro"), "utf8");
const favoriteCatalogSource = readFileSync(
  resolve("src/lib/favorites/referenceFavoriteCatalog.ts"),
  "utf8",
);
const machineChooserSource = readFileSync(
  resolve("src/pages/reference/machines/choose.astro"),
  "utf8",
);

describe("buying a used knitting machine reference page", () => {
  it("is a public prerendered reference page", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/reference/buying-a-used-knitting-machine"',
    );
    expect(pageSource).toContain("href={CANONICAL_URL}");
    expect(pageSource).toContain('const PAGE_H1 = "Buying a Used Knitting Machine"');
    expect(pageSource).toContain('title={PAGE_H1}');
    expect(pageSource).toContain('backHref="/reference"');
    expect(pageSource).toContain("Back to References");
    expect(pageSource).not.toContain("noindex");
  });

  it("links out to the machine chooser without changing that page", () => {
    expect(pageSource).toContain('const CHOOSE_MACHINE_HREF = "/reference/machines/choose"');
    expect(pageSource).toContain("Get Help Choosing a Machine");
    expect(pageSource).toContain(
      "Answer a few questions to share what you’re looking for with Sue.",
    );
    expect(machineChooserSource).not.toContain("/reference/buying-a-used-knitting-machine");
    expect(machineChooserSource).not.toContain("Get Help Choosing a Machine");
  });

  it("uses the sponge bar glossary entry and decorative card icons", () => {
    expect(pageSource).toContain("const SPONGE_BAR_GLOSSARY_ID = 524");
    expect(pageSource).toContain("<GlossaryTooltip id={SPONGE_BAR_GLOSSARY_ID}>sponge bar</GlossaryTooltip>");
    expect(pageSource).toContain('icon: "fa-camera"');
    expect(pageSource).toContain('icon: "fa-box"');
    expect(pageSource).toContain('icon: "fa-magnifying-glass"');
    expect(pageSource).toContain('icon: "fa-wrench"');
    expect(pageSource).toContain('icon: "fa-truck"');
    expect(pageSource).toContain('icon: "fa-calculator"');
    expect(pageSource).toContain('aria-hidden="true"');
  });

  it("includes the buying checklist", () => {
    expect(pageSource).toContain("Before you say yes");
    expect(pageSource).toContain("I know the exact brand and model.");
    expect(pageSource).toContain("I understand the seller’s return terms.");
    expect(pageSource).toContain("<ul class=\"used-machine-guide__checklist\">");
    expect(pageSource).not.toContain('type="checkbox"');
  });

  it("scans as a start-here note, six advice cards, and a stored-condition reminder", () => {
    expect(pageSource).toContain(
      "Check what works, what’s included, and what it will cost to get it home and knitting.",
    );
    expect(pageSource).toContain("<strong>Start here</strong>");
    expect(pageSource).toContain(
      "A carriage moving across an empty needlebed doesn’t demonstrate that it works.",
    );
    expect(pageSource).toContain('heading: "See it working"');
    expect(pageSource).toContain('heading: "Know what’s included"');
    expect(pageSource).toContain('heading: "Check condition and storage"');
    expect(pageSource).toContain('heading: "Find parts and support"');
    expect(pageSource).toContain('heading: "Plan pickup or shipping"');
    expect(pageSource).toContain('heading: "Calculate the real cost"');
    expect(pageSource).toContain(
      "‘Worked when stored’ doesn’t confirm that it works today.",
    );
    expect(pageSource).toContain("grid-template-columns: 1fr 1fr");
  });

  it("is listed on the References catalog and favorite catalog", () => {
    expect(referenceIndexSource).toContain('title: "Buying a Used Knitting Machine"');
    expect(referenceIndexSource).toContain('href: "/reference/buying-a-used-knitting-machine"');
    expect(favoriteCatalogSource).toContain('title: "Buying a Used Knitting Machine"');
    expect(favoriteCatalogSource).toContain('href: "/reference/buying-a-used-knitting-machine"');
  });
});
