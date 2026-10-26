import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../christmasStockingPatternLanding";
import { SOCKS_PATTERN_BUILDER_LANDING } from "../socksPatternLanding";
import {
  CHRISTMAS_STOCKING_GRAPH_PAPER_HREF,
  CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL,
  CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN,
  CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING,
  CHRISTMAS_STOCKING_STITCH_BROWSER_HREF,
  CHRISTMAS_STOCKING_STITCH_BROWSER_LABEL,
} from "./christmasStockingMakeItYourOwn";
import {
  buildChristmasStockingInstructions,
  renderChristmasStockingInstructionsHtml,
} from "./christmasStockingInstructions";
import { calculateChristmasStockingPattern } from "./christmasStockingMath";
import { sockPatternInpageNavItems } from "./sockPatternInpageNav";
import { calculateBasicSockPattern } from "../sock/sockMath";
import { renderBasicSockInstructionsHtml } from "../sock/sockInstructionRender";
import { buildBasicSockInstructions } from "../sock/sockInstructionBuild";

const PLAIN_MOTIFS = "Christmas 1, Christmas 2, and Christmas 3";

const stockingInput = {
  legLengthInches: 12,
  footCircumferenceInches: 14,
  footLengthInches: 9,
  stitchGaugeDisplay: 28,
  rowGaugeDisplay: 44,
  displayUnit: "inches" as const,
};

function paragraphText(lead: string, label: string | undefined, tail: string | undefined): string {
  return `${lead}${label ?? ""}${tail ?? ""}`;
}

function renderedStocking(direction: "cuff-down" | "toe-up"): string {
  const result = calculateChristmasStockingPattern({ ...stockingInput, direction });
  expect(result.ok).toBe(true);
  if (!result.ok) return "";
  return renderChristmasStockingInstructionsHtml(result.calc);
}

describe("Christmas stocking Make it your own", () => {
  it("uses the free graph paper tool and the main Stitch Browser", () => {
    const tools = JSON.parse(readFileSync(resolve("data/tools.json"), "utf8")) as Array<{
      href?: string;
      title?: string;
      membersonly?: boolean;
    }>;
    const graphPaper = tools.find((tool) => tool.href === CHRISTMAS_STOCKING_GRAPH_PAPER_HREF);
    expect(graphPaper?.title).toMatch(/graph paper/i);
    expect(graphPaper?.membersonly).toBe(false);
    expect(CHRISTMAS_STOCKING_GRAPH_PAPER_HREF).not.toBe(CHRISTMAS_STOCKING_STITCH_BROWSER_HREF);

    const header = readFileSync(resolve("src/components/Header.astro"), "utf8");
    expect(header).toContain(`href="${CHRISTMAS_STOCKING_STITCH_BROWSER_HREF}"`);
    expect(header).toContain(CHRISTMAS_STOCKING_STITCH_BROWSER_LABEL);
    const stitchPage = readFileSync(resolve("src/pages/stitch/index.astro"), "utf8");
    expect(stitchPage).toContain("<h1>Stitch Browser</h1>");
  });

  it("places the landing copy after the introduction and before the builder button", () => {
    const section = CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.makeItYourOwn;
    expect(section).toEqual(CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN);
    expect(section?.heading).toBe("Make it your own");
    expect(paragraphText(section!.paragraphs[0]!.lead, section!.paragraphs[0]!.link?.label, section!.paragraphs[0]!.tail)).toBe(
      "Plan your stocking design with the free Knitter’s Graph Paper Tool. Enter your stitch and row gauge to create graph paper that matches your knitting.",
    );
    expect(paragraphText(section!.paragraphs[1]!.lead, section!.paragraphs[1]!.link?.label, section!.paragraphs[1]!.tail)).toBe(
      `Looking for Christmas motifs? Members can explore ${PLAIN_MOTIFS} in the Stitch Browser.`,
    );
    expect(section?.paragraphs[0]?.link).toEqual({
      href: "/tools/graph-paper",
      label: CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL,
    });
    expect(section?.paragraphs[1]?.link).toEqual({
      href: "/stitch",
      label: "Stitch Browser",
    });
    expect(SOCKS_PATTERN_BUILDER_LANDING.makeItYourOwn).toBeUndefined();

    const hero = readFileSync(resolve("src/components/patterns/PatternBuilderLandingHero.astro"), "utf8");
    const introAt = hero.indexOf("pattern-builder-hero__intro");
    const ownAt = hero.indexOf("data-pattern-builder-make-it-your-own");
    const actionsAt = hero.indexOf("pattern-builder-hero__actions");
    expect(ownAt).toBeGreaterThan(introAt);
    expect(actionsAt).toBeGreaterThan(ownAt);
    expect(hero).toContain("makeItYourOwn ?");
  });

  it("places the same note before knitting in both construction directions", () => {
    for (const direction of ["cuff-down", "toe-up"] as const) {
      const html = renderedStocking(direction);
      const ownAt = html.indexOf("data-christmas-stocking-make-it-your-own");
      const labelAt = html.indexOf("sock-instructions__label");
      const knittingAt = html.indexOf("data-section-id=");
      expect(html.split("data-christmas-stocking-make-it-your-own").length - 1).toBe(1);
      expect(ownAt).toBeGreaterThan(labelAt);
      expect(ownAt).toBeLessThan(html.indexOf("data-socks-anatomy-video"));
      expect(ownAt).toBeLessThan(knittingAt);
      expect(html).toContain(CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING);
      expect(html).toContain(`href="${CHRISTMAS_STOCKING_GRAPH_PAPER_HREF}"`);
      expect(html).toContain(`>${CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL}</a>`);
      expect(html).toContain(`href="${CHRISTMAS_STOCKING_STITCH_BROWSER_HREF}"`);
      expect(html).toContain(`>${CHRISTMAS_STOCKING_STITCH_BROWSER_LABEL}</a>`);
      expect(html).toContain(PLAIN_MOTIFS);
      expect(html).not.toMatch(/<a\b[^>]*>[^<]*Christmas [123]/);
      expect(html).not.toMatch(/href="[^"]*christmas/i);

      const result = calculateChristmasStockingPattern({ ...stockingInput, direction });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const labels = sockPatternInpageNavItems(buildChristmasStockingInstructions(result.calc)).map(
        (item) => item.label,
      );
      expect(labels).not.toContain(CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING);
    }
  });

  it("stays off Basic Socks instructions", () => {
    for (const constructionDirection of ["cuff-to-toe", "toe-up"] as const) {
      const result = calculateBasicSockPattern({
        footCircumferenceInches: 8.5,
        footLengthInches: 9,
        legCircumferenceInches: 8.5,
        legLengthInches: 4.5,
        stitchGaugeDisplay: 28,
        rowGaugeDisplay: 40,
        displayUnit: "inches",
        constructionDirection,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const html = renderBasicSockInstructionsHtml(buildBasicSockInstructions(result.calc, 1));
      expect(html).not.toContain("data-christmas-stocking-make-it-your-own");
      expect(html).not.toContain(CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING);
      expect(html).not.toContain(CHRISTMAS_STOCKING_GRAPH_PAPER_HREF);
    }
  });
});
