import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../patterns/christmasStockingPatternLanding";
import { buildSockBuilderNewPatternHref } from "../patterns/christmasStocking/sockFreshStart";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLES_CARDS } from "./knitAblesLanding";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import {
  CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CTA,
  CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL,
  CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
  CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING,
  CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO,
  CHRISTMAS_STOCKINGS_YOUR_WAY_MAIN_COPY,
  CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
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
const templateSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"),
  "utf8",
);
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
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.description).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION).toBe(
      "Choose your size, use your yarn, and make it your own. Take inspiration from these Knit Picks stockings, then use the Christmas Stocking builder to create your machine knitting instructions at your gauge.",
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

  it("keeps the approved inspiration copy in the shared page sections", () => {
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE).toBe(
      "Choose your size, use your yarn, and make it your own.",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.tagline).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO).toBe(
      "Take inspiration from these Knit Picks stockings, then use the Christmas Stocking builder to create your machine knitting instructions at your gauge.",
    );
    expect(
      `${CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE}${CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL}${CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER}`,
    ).toBe(CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO);
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
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_MAIN_COPY).toEqual([
      "Make a little stocking for a small gift or a larger one to fill with Christmas surprises. Choose from the builder's stocking sizes, swatch your yarn, and enter your gauge.",
      "Add your favorite colors and stitch patterns to the leg and foot, keeping the heel and toe plain. Make matching stockings for the family or give each one its own personality.",
    ]);
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.builder.closing).toEqual(
      CHRISTMAS_STOCKINGS_YOUR_WAY_MAIN_COPY.map((text) => ({ text })),
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING).toBe("Knit Picks Holiday Stockings");
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY).toBe(
      "Like the snowflakes and reindeer? The Knit Picks Holiday Stockings hand knitting pattern is available separately. Check its motif widths against your stocking's stitch count when planning your design. Use the Knit It Now builder for your machine knitting shaping instructions.",
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.pattern.copy).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
    );
    expect(CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE.lessons).toBeUndefined();
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
