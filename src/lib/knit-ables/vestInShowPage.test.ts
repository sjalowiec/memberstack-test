import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSleevelessBuilderNewPatternHref } from "../patterns/patternStorage";
import { SLEEVELESS_PATTERN_BUILDER_LANDING } from "../patterns/sleevelessPatternLanding";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLES_CARDS } from "./knitAblesLanding";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import {
  VEST_IN_SHOW_AFFILIATE_DISCLOSURE,
  VEST_IN_SHOW_BUILD_STEPS,
  VEST_IN_SHOW_BUILDER_COPY_AFTER,
  VEST_IN_SHOW_BUILDER_COPY_BEFORE,
  VEST_IN_SHOW_BUILDER_HEADING,
  VEST_IN_SHOW_BUILDER_LINK_LABEL,
  VEST_IN_SHOW_CANONICAL_URL,
  VEST_IN_SHOW_CARD_COPY,
  VEST_IN_SHOW_CTA,
  VEST_IN_SHOW_CTA_LABEL,
  VEST_IN_SHOW_DESCRIPTION,
  VEST_IN_SHOW_IMAGES,
  VEST_IN_SHOW_INSPIRED_COPY,
  VEST_IN_SHOW_INSPIRED_HEADING,
  VEST_IN_SHOW_INTRO,
  VEST_IN_SHOW_KNITTER_TIP,
  VEST_IN_SHOW_ORIGINAL_PATTERN_URL,
  VEST_IN_SHOW_PAGE,
  VEST_IN_SHOW_PATH,
  VEST_IN_SHOW_PATTERN_LINK_LABEL,
  VEST_IN_SHOW_RIBBING_NOTE,
  VEST_IN_SHOW_TAGLINE,
  VEST_IN_SHOW_TITLE,
  VEST_IN_SHOW_YARN,
  VEST_IN_SHOW_YARN_HEADING,
  VEST_IN_SHOW_YARN_URL,
  vestInShowBuilderHref,
  vestInShowLandingHref,
} from "./vestInShow";

const pageSource = readFileSync(resolve("src/pages/knit-ables/vest-in-show.astro"), "utf8");
const templateSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"),
  "utf8",
);
const capSleevePage = readFileSync(resolve("src/pages/knit-ables/cap-sleeve-tank.astro"), "utf8");
const cocoLocoPage = readFileSync(resolve("src/pages/knit-ables/coco-loco-tank.astro"), "utf8");
const teenageKicksPage = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const worstedPage = readFileSync(
  resolve("src/pages/knit-ables/worsted-color-block-socks.astro"),
  "utf8",
);

describe("Vest in Show Knit-able page", () => {
  it("is a server-rendered inspiration page at the Knit-able route", () => {
    expect(VEST_IN_SHOW_PATH).toBe("/knit-ables/vest-in-show");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: VEST_IN_SHOW_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("KnitAbleInspirationPage");
    expect(pageSource).toContain("content={VEST_IN_SHOW_PAGE}");
    expect(VEST_IN_SHOW_PAGE.canonicalUrl).toBe(VEST_IN_SHOW_CANONICAL_URL);
    expect(VEST_IN_SHOW_CANONICAL_URL).toBe("https://knititnow.com/knit-ables/vest-in-show");
    expect(VEST_IN_SHOW_TITLE).toBe("Vest in Show");
    expect(VEST_IN_SHOW_PAGE.title).toBe(VEST_IN_SHOW_TITLE);
    expect(VEST_IN_SHOW_DESCRIPTION).toBe(
      "Love the Vest in Show look? Use your knitting machine, your gauge, and your measurements to create a custom sleeveless V-neck inspired by this colorful Sirdar design.",
    );
    expect(VEST_IN_SHOW_PAGE.description).toBe(VEST_IN_SHOW_DESCRIPTION);
    expect(templateSource).toContain("`${content.title} | Knit it Now`");
    expect(templateSource).toContain("description={content.description}");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["vest-in-show"]).toBeUndefined();
    expect(KNIT_ABLES_CARDS[0]?.href).toBe(VEST_IN_SHOW_PATH);
    expect(KNIT_ABLES_CARDS[0]?.title).toBe(VEST_IN_SHOW_TITLE);
    expect(KNIT_ABLES_CARDS[0]?.description).toBe(VEST_IN_SHOW_CARD_COPY);
  });

  it("uses the supplied Vest in Show thumbnail", () => {
    expect(VEST_IN_SHOW_IMAGES.hero.src).toBe("/images/knit-ables/vest-in-show/vest-in-show.gif");
    expect(VEST_IN_SHOW_IMAGES.hero.fileName).toBe("vest-in-show.gif");
    expect(VEST_IN_SHOW_IMAGES.hero.width).toBe(500);
    expect(VEST_IN_SHOW_IMAGES.hero.height).toBe(638);
    expect(VEST_IN_SHOW_IMAGES.hero.alt).toContain("V-neck sleeveless pullover");
    expect(VEST_IN_SHOW_PAGE.hero.src).toBe(VEST_IN_SHOW_IMAGES.hero.src);
    expect(VEST_IN_SHOW_PAGE.hero.href).toBe(VEST_IN_SHOW_ORIGINAL_PATTERN_URL);
    expect(existsSync(resolve(`public${VEST_IN_SHOW_IMAGES.hero.src}`))).toBe(true);
    expect(VEST_IN_SHOW_IMAGES.hero.src).not.toMatch(/^https?:/);
    expect(pageSource).not.toContain("sirdar.com");
    expect(templateSource).not.toContain("vest-in-show");
  });

  it("keeps the inspiration copy in the shared page sections", () => {
    expect(VEST_IN_SHOW_TAGLINE).toBe(
      "Simple shape + gorgeous yarn = a great machine knitting project.",
    );
    expect(VEST_IN_SHOW_PAGE.tagline).toBe(VEST_IN_SHOW_TAGLINE);
    expect(VEST_IN_SHOW_INTRO).toContain("classic V-neck");
    expect(VEST_IN_SHOW_INTRO).toContain("your own measurements and gauge");
    expect(VEST_IN_SHOW_PAGE.intro).toBe(VEST_IN_SHOW_INTRO);
    expect(VEST_IN_SHOW_BUILDER_HEADING).toBe("Make it on your knitting machine");
    expect(VEST_IN_SHOW_PAGE.builder.heading).toBe(VEST_IN_SHOW_BUILDER_HEADING);
    expect(VEST_IN_SHOW_BUILDER_COPY_BEFORE).toBe("Use the Knit it Now ");
    expect(VEST_IN_SHOW_BUILDER_LINK_LABEL).toBe("Sleeveless Pattern");
    expect(VEST_IN_SHOW_BUILDER_COPY_AFTER).toBe(" to create your own version. Choose:");
    expect(VEST_IN_SHOW_PAGE.builder.introduction).toEqual({
      before: VEST_IN_SHOW_BUILDER_COPY_BEFORE,
      link: {
        label: VEST_IN_SHOW_BUILDER_LINK_LABEL,
        href: vestInShowLandingHref(),
      },
      after: VEST_IN_SHOW_BUILDER_COPY_AFTER,
    });
    expect(VEST_IN_SHOW_BUILD_STEPS).toEqual([
      "Pullover",
      "V-neck",
      "Your preferred finished length",
      "Your desired V-neck depth",
      "Your own measurements",
      "Your own gauge",
    ]);
    expect(VEST_IN_SHOW_PAGE.builder.steps).toEqual(VEST_IN_SHOW_BUILD_STEPS);
    expect(VEST_IN_SHOW_RIBBING_NOTE).toContain("hem, neckline, and armholes");
    expect(VEST_IN_SHOW_KNITTER_TIP).toContain("embrace the variations");
    expect(VEST_IN_SHOW_PAGE.builder.closing).toEqual([
      { text: VEST_IN_SHOW_RIBBING_NOTE },
      { text: VEST_IN_SHOW_KNITTER_TIP },
    ]);
    expect(VEST_IN_SHOW_INSPIRED_HEADING).toBe("Inspired by Vest in Show");
    expect(VEST_IN_SHOW_INSPIRED_COPY).toContain("does not reproduce or provide");
    expect(VEST_IN_SHOW_INSPIRED_COPY).toContain("copyrighted pattern");
    expect(VEST_IN_SHOW_PAGE.pattern.copy).toBe(VEST_IN_SHOW_INSPIRED_COPY);
  });

  it("opens a new Sleeveless pattern with the landing-page membership actions", () => {
    expect(vestInShowLandingHref()).toBe("/patterns/sleeveless");
    expect(vestInShowBuilderHref()).toBe("/patterns/sleeveless/builder?new=1");
    expect(vestInShowBuilderHref()).toBe(buildSleevelessBuilderNewPatternHref());
    expect(VEST_IN_SHOW_PAGE.builder.introduction.link?.href).toBe(vestInShowLandingHref());
    expect(VEST_IN_SHOW_CTA_LABEL).toBe("Create Your Sleeveless Pattern");
    expect(VEST_IN_SHOW_CTA.memberLabel).toBe(VEST_IN_SHOW_CTA_LABEL);
    expect(VEST_IN_SHOW_CTA.memberHref).toBe(vestInShowBuilderHref());
    expect(VEST_IN_SHOW_CTA.memberHref).toBe(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.memberHref);
    expect(VEST_IN_SHOW_CTA.prospectLabel).toBe(
      SLEEVELESS_PATTERN_BUILDER_LANDING.cta.prospectLabel,
    );
    expect(VEST_IN_SHOW_CTA.prospectHref).toBe(
      SLEEVELESS_PATTERN_BUILDER_LANDING.cta.prospectHref,
    );
    expect(VEST_IN_SHOW_CTA.signInLabel).toBe(SLEEVELESS_PATTERN_BUILDER_LANDING.cta.signInLabel);
    expect(VEST_IN_SHOW_CTA.checkingLabel).toBe(
      SLEEVELESS_PATTERN_BUILDER_LANDING.cta.checkingLabel,
    );
    expect(VEST_IN_SHOW_PAGE.builder.cta).toBe(VEST_IN_SHOW_CTA);
    expect(pageSource).not.toContain("/patterns/sleeveless");
    expect(templateSource).toContain("initPatternBuilderLandingCta");
    expect(templateSource).toContain("content.builder.cta.memberHref");
    expect(templateSource).toContain('data-ms-modal="login"');
  });

  it("opens the pattern and yarn pages through the supplied Awin affiliate links", () => {
    expect(VEST_IN_SHOW_ORIGINAL_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2F10844-vest-in-show-pullover-knitting-pattern-in-sirdar-jewelspun-ombre",
    );
    expect(VEST_IN_SHOW_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2Fsirdar-jewelspun-ombre-aran-400g",
    );
    expect(VEST_IN_SHOW_PATTERN_LINK_LABEL).toBe("Get the Original Pattern");
    expect(VEST_IN_SHOW_PAGE.pattern.linkLabel).toBe(VEST_IN_SHOW_PATTERN_LINK_LABEL);
    expect(VEST_IN_SHOW_PAGE.pattern.href).toBe(VEST_IN_SHOW_ORIGINAL_PATTERN_URL);
    expect(VEST_IN_SHOW_YARN_HEADING).toBe("Yarn inspiration");
    expect(VEST_IN_SHOW_YARN.heading).toBe("Sirdar Jewelspun Ombre");
    expect(VEST_IN_SHOW_YARN.buttonLabel).toBe("Shop the Yarn");
    expect(VEST_IN_SHOW_YARN.href).toBe(VEST_IN_SHOW_YARN_URL);
    expect(VEST_IN_SHOW_PAGE.yarn).toMatchObject({
      heading: VEST_IN_SHOW_YARN_HEADING,
      cardHeading: VEST_IN_SHOW_YARN.heading,
      buttonLabel: VEST_IN_SHOW_YARN.buttonLabel,
      href: VEST_IN_SHOW_YARN_URL,
    });
    expect(VEST_IN_SHOW_YARN.paragraphs.join(" ")).toContain(
      "should not try to match the hand-knitting gauge",
    );
    expect(VEST_IN_SHOW_YARN.paragraphs.join(" ")).toContain(
      "Swatch the yarn on your machine and use YOUR gauge",
    );
    expect(VEST_IN_SHOW_YARN.paragraphs.join(" ")).toContain("18 stitches and 24 rows");
    expect(VEST_IN_SHOW_PAGE.yarn.image).toBeUndefined();
    expect(VEST_IN_SHOW_AFFILIATE_DISCLOSURE).toContain("affiliate links");
    expect(VEST_IN_SHOW_PAGE.affiliateDisclosure).toBe(VEST_IN_SHOW_AFFILIATE_DISCLOSURE);
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(templateSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(templateSource).toContain('target="_blank"');
    expect(pageSource).not.toContain("awin1.com");
  });

  it("leaves the earlier Knit-able pages unchanged", () => {
    expect(templateSource).not.toContain("Vest in Show");
    expect(templateSource).not.toContain("Jewelspun");
    expect(capSleevePage).not.toContain("vest-in-show");
    expect(cocoLocoPage).not.toContain("vest-in-show");
    expect(teenageKicksPage).not.toContain("vest-in-show");
    expect(worstedPage).not.toContain("vest-in-show");
  });
});
