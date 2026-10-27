import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../patterns/christmasStockingPatternLanding";
import { buildSockBuilderNewPatternHref } from "../patterns/christmasStocking/sockFreshStart";
import { COCO_LOCO_TANK_PAGE } from "./cocoLocoTank";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLES_CARDS } from "./knitAblesLanding";
import { RHYTHMIC_COLOUR_TOP_PAGE } from "./rhythmicColourTop";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import { VEST_IN_SHOW_PAGE } from "./vestInShow";
import {
  CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HELP,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CTA,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
  CHRISTMAS_STOCKINGS_YOUR_WAY_EYEBROW,
  CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO,
  CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_INTRO,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PATH,
  CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_YARN,
  CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL,
  christmasStockingsYourWayBuilderHref,
} from "./christmasStockingsYourWay";

const pageSource = readFileSync(
  resolve("src/pages/knit-ables/christmas-stockings-your-way.astro"),
  "utf8",
);
const templateSource = [
  readFileSync(resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"), "utf8"),
  readFileSync(resolve("src/components/knit-ables/KnitAbleInspirationBuilder.astro"), "utf8"),
].join("\n");
const landingSource = readFileSync(resolve("src/pages/knit-ables/index.astro"), "utf8");

function pngSize(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("Christmas Stockings, Your Way Knit-able page", () => {
  it("is an unpublished server-rendered inspiration page", () => {
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PATH).toBe("/knit-ables/christmas-stockings-your-way");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: CHRISTMAS_STOCKINGS_YOUR_WAY_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("KnitAbleInspirationPage");
    expect(pageSource).toContain("content={CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE}");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.canonicalUrl).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/christmas-stockings-your-way",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE).toBe("Christmas Stockings, Your Way");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.title).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_EYEBROW).toBe("Hand to Machine Inspiration");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.eyebrow).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_EYEBROW);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.description).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION).toBe(
      "Choose your size, use your yarn, and make it your own. The stockings in the photo are the Knit Picks Holiday Stockings, a hand-knitting pattern. Use them for ideas, then make your own on the machine.",
    );
    expect(templateSource).toContain("`${content.title} | Knit it Now`");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["christmas-stockings-your-way"]).toBeUndefined();
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.lessons).toBeUndefined();
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.palette).toBeUndefined();
    expect(KNIT_ABLES_CARDS[0]?.href).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_PATH);
    expect(KNIT_ABLES_CARDS[0]?.title).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE);
    expect(KNIT_ABLES_CARDS[0]?.description).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY);
    expect(KNIT_ABLES_CARDS[0]?.image.src).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src);
    expect(KNIT_ABLES_CARDS[0]?.image).toMatchObject({
      width: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.width,
      height: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.height,
    });
  });

  it("uses the supplied stockings photo at its own proportions", () => {
    const imagePath = resolve(`public${CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src}`);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src).toBe(
      "/images/knit-ables/christmas-stockings/christmas-stockings.png",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.fileName).toBe("christmas-stockings.png");
    expect(existsSync(imagePath)).toBe(true);
    expect(pngSize(imagePath)).toEqual({
      width: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.width,
      height: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.height,
    });
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.width).toBe(403);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.height).toBe(600);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.alt).toContain("two red, white, and blue");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.hero).toMatchObject({
      src: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src,
      width: 403,
      height: 600,
      href: CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
    });
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src).not.toMatch(/^https?:/);
    expect(pageSource).not.toContain("christmas-stockings.png");
    expect(templateSource).toContain("object-fit: contain");
    expect(templateSource).toContain("height: auto");
    expect(templateSource).toContain("aspect-ratio: auto !important");
    expect(landingSource).toContain("object-fit: contain");
    expect(landingSource).toContain("height: auto");
  });

  it("shows Sue's perspective before the builder, without a new card or a course", () => {
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.placeBuilderBesidePhoto).toBeUndefined();
    expect(VEST_IN_SHOW_PAGE.placeBuilderBesidePhoto).toBeUndefined();
    expect(RHYTHMIC_COLOUR_TOP_PAGE.placeBuilderBesidePhoto).toBeUndefined();
    expect(COCO_LOCO_TANK_PAGE.placeBuilderBesidePhoto).toBeUndefined();
    expect(VEST_IN_SHOW_PAGE.perspective).toBeUndefined();
    expect(RHYTHMIC_COLOUR_TOP_PAGE.perspective).toBeUndefined();
    expect(COCO_LOCO_TANK_PAGE.perspective).toBeUndefined();
    expect(pageSource).toContain("KnitAbleInspirationPage");
    expect(pageSource).not.toContain("KnitAbleInspirationBuilder");
    expect(pageSource).not.toContain("lessons");
    const heroClose = templateSource.indexOf("</section>", templateSource.indexOf('class="knit-able-hero__copy"'));
    const afterHero = templateSource.slice(heroClose, templateSource.indexOf('class="knit-able-pair"'));
    const perspectiveAt = afterHero.indexOf('class="knit-able-perspective"');
    const builderAt = afterHero.indexOf("<KnitAbleInspirationBuilder");
    expect(perspectiveAt).toBeGreaterThan(-1);
    expect(builderAt).toBeGreaterThan(perspectiveAt);
    expect(afterHero).toContain("knit-able-perspective__points");
    expect(afterHero).toContain("knit-able-perspective__voice");
    expect(afterHero).toContain("knit-able-perspective__tip");
    expect(afterHero).not.toContain("knit-able-perspective-card");
    expect(afterHero).not.toMatch(/sue\.(png|jpg|webp)|portrait/i);
    expect(templateSource).toContain("content.builder.cta.memberHref");
    expect(templateSource).toContain('data-ms-modal="login"');
  });

  it("keeps the hand-knit pattern distinct from the machine-knitting builder", () => {
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE).toBe(
      "Choose your size, use your yarn, and make it your own.",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.tagline).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.intro).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO).toContain("hand-knitting pattern");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_HEADING).toBe(
      "Through the Eyes of a Machine Knitter",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.perspective).toMatchObject({
      heading: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_HEADING,
      intro: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_INTRO,
      introVoice: true,
      points: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS,
    });
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_INTRO).toBe(
      "When I saw these stockings, I immediately started thinking about the possibilities. You could make a matching set, choose a different design for each family member, or use up some favorite yarn.",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS.map((point) => point.lead)).toEqual([
      "Start with the shape.",
      "Make it yours.",
      "Have fun with the design.",
      "Sue’s tip:",
    ]);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[0]?.paragraphs[0]).toContain(
      "knitted flat in one piece",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[0]?.paragraphs[0]).toContain(
      "short-row shaping for the heel and toe",
    );
    const machine = String(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[1]?.paragraphs[0]);
    expect(machine).toContain("from an LK150 to an electronic machine");
    expect(machine).not.toContain("fits the bed");
    expect(machine).not.toContain("depends on what that machine can do");
    expect(machine).not.toMatch(/any machine/i);
    const designParts = CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[2]?.paragraphs ?? [];
    const designText = designParts
      .map((paragraph) =>
        Array.isArray(paragraph)
          ? paragraph.map((part) => (typeof part === "string" ? part : part.label)).join("")
          : paragraph,
      )
      .join(" ");
    expect(designText).toContain("Knit Picks hand-knitting pattern");
    expect(designText).toContain("Knitter’s Graph Paper Tool");
    expect(designText).toContain("Browse Christmas stitch patterns");
    expect(designText).not.toContain("Christmas 1, Christmas 2, and Christmas 3");
    expect(designText).toContain("stocking’s stitch count");
    expect(designParts[1]).toEqual([
      { label: "Knitter’s Graph Paper Tool", href: "/tools/graph-paper" },
    ]);
    expect(designParts[2]).toEqual([
      { label: "Browse Christmas stitch patterns", href: "/stitch/christmas" },
    ]);
    expect(templateSource).toContain("knit-able-perspective__resource");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[3]?.callout).toBe(true);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS[3]?.paragraphs[0]).toContain(
      "single color",
    );
    expect(templateSource).toContain("border: 1.5px solid #6d8748");
    expect(templateSource).toContain("knit-able-perspective__voice::before");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS.slice(0, 3).every((point) => !("callout" in point && point.callout))).toBe(true);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING).toBe("Christmas Stocking builder");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.heading).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.introduction).toEqual({
      before: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE,
      link: {
        label: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL,
        href: christmasStockingsYourWayBuilderHref(),
      },
      after: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER,
    });
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.steps).toEqual([]);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.closing).toEqual([
      { text: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HELP },
      ...CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.map((text) => ({ text })),
    ]);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.join(" ")).toContain(
      "paid Knit It Now membership",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.join(" ")).toContain(
      "view, print, and download",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.join(" ")).toContain("active membership");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.join(" ")).not.toContain(
      "without a membership",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING).toBe("Knit Picks Holiday Stockings");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY).toContain("hand-knitting pattern");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY).toContain("machine-knitting builder");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.pattern.copy).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.lessons).toBeUndefined();
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY).toContain("Christmas Stocking builder");
    expect(JSON.stringify(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE)).not.toMatch(/any yarn|any machine|unlimited/i);
  });

  it("opens a new Christmas Stocking in the builder", () => {
    expect(existsSync(resolve("src/pages/patterns/christmas-stocking/builder.astro"))).toBe(true);
    expect(christmasStockingsYourWayBuilderHref()).toBe(
      "/patterns/christmas-stocking/builder?new=1",
    );
    expect(christmasStockingsYourWayBuilderHref()).toBe(buildSockBuilderNewPatternHref());
    expect(christmasStockingsYourWayBuilderHref()).not.toBe("/patterns/socks/builder?new=1");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.introduction.link?.href).toBe(
      christmasStockingsYourWayBuilderHref(),
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL).toBe("Create Your Christmas Stocking");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.memberLabel).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.memberHref).toBe(
      christmasStockingsYourWayBuilderHref(),
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.memberHref).toBe(
      CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta.memberHref,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.prospectLabel).toBe(
      CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta.prospectLabel,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.prospectHref).toBe(
      CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta.prospectHref,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.signInLabel).toBe(
      CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta.signInLabel,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA.checkingLabel).toBe(
      CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta.checkingLabel,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.cta).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_CTA);
    expect(pageSource).not.toContain("/patterns/christmas-stocking");
    expect(templateSource).toContain("initPatternBuilderLandingCta");
    expect(templateSource).toContain("content.builder.cta.memberHref");
  });

  it("opens the pattern and yarn pages through the supplied Awin affiliate links", () => {
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fholiday-stockings-knitting-pattern%2Fp%2F52323D",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fwool-of-the-andes-worsted-yarn%2Fc%2F5420103",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL).toBe("Shop the Knit Picks Pattern");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.pattern.linkLabel).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.pattern.href).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.hero.href).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING).toBe("Yarn inspiration");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.heading).toBe("Wool of the Andes Worsted");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.buttonLabel).toBe("Shop Wool of the Andes Worsted");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.href).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.paragraphs.join(" ")).toContain("one yarn you can shop");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.paragraphs.join(" ")).not.toMatch(/required|specified/i);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.yarn).toMatchObject({
      heading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING,
      cardHeading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.heading,
      buttonLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.buttonLabel,
      href: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL,
    });
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.yarn.image).toBeUndefined();
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE).toBe(
      "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.affiliateDisclosure).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
    );
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(templateSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(templateSource).toContain('target="_blank"');
    expect(pageSource).not.toContain("awin1.com");
  });
});
