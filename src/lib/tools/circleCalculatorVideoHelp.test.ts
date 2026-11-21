import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CIRCLE_CALCULATOR_VIDEO_HELP_CONTENT_IDS,
  CIRCLE_CALCULATOR_VIDEO_HELP_HEADING,
  CIRCLE_CALCULATOR_VIDEO_HELP_SECTION_ID,
  planCircleVideoHelpClick,
  renderCircleCalculatorVideoHelpSectionHtml,
  resolveCircleCalculatorVideoHelp,
  vimeoIdFromPlayerSrc,
} from "./circleCalculatorVideoHelp";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "../../pages/tools/circle-calculator.astro"), "utf8");
const modalSource = readFileSync(
  join(pageDir, "../../components/common/KinCatalogVideoModal.astro"),
  "utf8",
);

describe("circle calculator video help", () => {
  it("orders decreased wedges, increased wedges, then the short-row pinwheel", () => {
    expect(CIRCLE_CALCULATOR_VIDEO_HELP_CONTENT_IDS).toEqual([659, 660, 658]);
    const cards = resolveCircleCalculatorVideoHelp();
    expect(cards.map((card) => card.contentId)).toEqual([659, 660, 658]);
    expect(cards.map((card) => card.title)).toEqual([
      "Circles - Decreased Wedges",
      "Circles - Increased Wedges",
      "Pinwheel Circles - Shortrow Fun",
    ]);
    expect(cards.every((card) => card.access === "member")).toBe(true);
    expect(cards.every((card) => card.posterUrl.startsWith("https://"))).toBe(true);
    expect(cards[0]?.description).toContain("Learn to create circular shapes with wedges.");
    expect(cards[2]?.description).toContain("one-piece circular shape with short-rows");
  });

  it("renders compact cards without a member Vimeo id", () => {
    const html = renderCircleCalculatorVideoHelpSectionHtml(undefined, { videoDevBypass: false });
    expect(html).toContain(CIRCLE_CALCULATOR_VIDEO_HELP_HEADING);
    expect(html).toContain(`id="${CIRCLE_CALCULATOR_VIDEO_HELP_SECTION_ID}"`);
    expect(html).toContain('class="circle-video-help__grid"');
    expect(html.indexOf('data-content-id="659"')).toBeLessThan(html.indexOf('data-content-id="660"'));
    expect(html.indexOf('data-content-id="660"')).toBeLessThan(html.indexOf('data-content-id="658"'));
    expect(html).toContain("kbm-lock-overlay");
    expect(html).not.toContain("data-vimeo-id");
    expect(html).not.toContain("kbm-kin-catalog-video");
    expect(html).not.toContain("player.vimeo.com");
    expect(html).not.toContain("151859578");
    expect(html).not.toContain("151859583");
    expect(html).not.toContain("151859605");
  });

  it("arms the site modal only for the local video bypass", () => {
    const html = renderCircleCalculatorVideoHelpSectionHtml(undefined, { videoDevBypass: true });
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain('data-vimeo-id="151859583"');
    expect(html).toContain("data-vimeo-defer");
    expect(html).toContain("is-unlocked");
    expect(html).not.toContain("kbm-lock-overlay");
  });

  it("keeps a locked member click from requesting playback", () => {
    expect(
      planCircleVideoHelpClick({ armedWithVimeoId: false, hasMemberAccess: false }),
    ).toBe("stay-locked");
    expect(
      planCircleVideoHelpClick({ armedWithVimeoId: false, hasMemberAccess: true }),
    ).toBe("request-embed");
    expect(
      planCircleVideoHelpClick({ armedWithVimeoId: true, hasMemberAccess: true }),
    ).toBe("open-modal");
    expect(vimeoIdFromPlayerSrc("https://player.vimeo.com/video/151859583?api=1")).toBe("151859583");
    expect(vimeoIdFromPlayerSrc("https://example.com/watch")).toBeNull();
  });

  it("omits a card when that catalog row is missing", () => {
    const html = renderCircleCalculatorVideoHelpSectionHtml(
      [
        {
          contentId: 659,
          title: "Circles - Decreased Wedges",
          description: "Learn to create circular shapes with wedges.",
          posterUrl: "https://i.vimeocdn.com/video/example.jpg",
          access: "member",
        },
      ],
      { videoDevBypass: false },
    );
    expect(html).toContain('data-content-id="659"');
    expect(html).not.toContain('data-content-id="660"');
    expect(html).not.toContain('data-content-id="658"');
  });

  it("places the technique link by the construction choices and the section below the pattern", () => {
    const linkAt = pageSource.indexOf("Watch construction videos");
    const constructionAt = pageSource.indexOf('name="construction"');
    const directionAt = pageSource.indexOf('name="direction"');
    const resultsAt = pageSource.indexOf('id="circleResults"');
    const sectionAt = pageSource.indexOf("circle-video-help-mount");
    expect(linkAt).toBeGreaterThan(constructionAt);
    expect(linkAt).toBeLessThan(directionAt);
    expect(pageSource).toContain(`href="#${CIRCLE_CALCULATOR_VIDEO_HELP_SECTION_ID}"`);
    expect(sectionAt).toBeGreaterThan(resultsAt);
    expect(pageSource).toContain("initCircleCalculatorVideoHelp");
    expect(pageSource).not.toMatch(/circle-construction-photo|image-swap|swapImage/i);
    expect(modalSource).toContain('class="kbm-kin-catalog-video"');
    expect(modalSource).toContain("lastFocus.focus");
  });
});
