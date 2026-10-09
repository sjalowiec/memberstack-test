import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSidewaysCardiganBuilderNewPatternHref } from "../patterns/patternStorage";
import {
  SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING,
  SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH,
} from "../patterns/sidewaysKnitSweaterPatternLanding";
import { knitAbleInspirationIntroParagraphs } from "./inspirationPage";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLES_CARDS } from "./knitAblesLanding";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import {
  RHYTHMIC_COLOUR_TOP_AFFILIATE_DISCLOSURE,
  RHYTHMIC_COLOUR_TOP_ANY_YARN,
  RHYTHMIC_COLOUR_TOP_BUILD_STEPS,
  RHYTHMIC_COLOUR_TOP_BUILDER_COPY_AFTER,
  RHYTHMIC_COLOUR_TOP_BUILDER_COPY_BEFORE,
  RHYTHMIC_COLOUR_TOP_BUILDER_HEADING,
  RHYTHMIC_COLOUR_TOP_BUILDER_LINK_LABEL,
  RHYTHMIC_COLOUR_TOP_CANONICAL_URL,
  RHYTHMIC_COLOUR_TOP_CARD_COPY,
  RHYTHMIC_COLOUR_TOP_CROCHET_BODY,
  RHYTHMIC_COLOUR_TOP_CROCHET_CHOICE,
  RHYTHMIC_COLOUR_TOP_CROCHET_HEADING,
  RHYTHMIC_COLOUR_TOP_CROCHET_INTRO,
  RHYTHMIC_COLOUR_TOP_CTA,
  RHYTHMIC_COLOUR_TOP_CTA_LABEL,
  RHYTHMIC_COLOUR_TOP_DESCRIPTION,
  RHYTHMIC_COLOUR_TOP_IMAGES,
  RHYTHMIC_COLOUR_TOP_INSPIRED_COPY,
  RHYTHMIC_COLOUR_TOP_INSPIRED_HEADING,
  RHYTHMIC_COLOUR_TOP_INTRO,
  RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL,
  RHYTHMIC_COLOUR_TOP_PAGE,
  RHYTHMIC_COLOUR_TOP_PATH,
  RHYTHMIC_COLOUR_TOP_PATTERN_LINK_LABEL,
  RHYTHMIC_COLOUR_TOP_TAGLINE,
  RHYTHMIC_COLOUR_TOP_TITLE,
  RHYTHMIC_COLOUR_TOP_YARN,
  RHYTHMIC_COLOUR_TOP_YARN_HEADING,
  RHYTHMIC_COLOUR_TOP_YARN_URL,
  rhythmicColourTopLandingHref,
} from "./rhythmicColourTop";

const pageSource = readFileSync(
  resolve("src/pages/knit-ables/rhythmic-colour-top.astro"),
  "utf8",
);
const templateSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"),
  "utf8",
);
const sidewaysLandingPage = readFileSync(
  resolve("src/pages/patterns/sideways-cardigan/index.astro"),
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

describe("Rhythmic Colour Top Knit-able page", () => {
  it("is an unpublished server-rendered inspiration page", () => {
    expect(RHYTHMIC_COLOUR_TOP_PATH).toBe("/knit-ables/rhythmic-colour-top");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: RHYTHMIC_COLOUR_TOP_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("KnitAbleInspirationPage");
    expect(pageSource).toContain("content={RHYTHMIC_COLOUR_TOP_PAGE}");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.canonicalUrl).toBe(RHYTHMIC_COLOUR_TOP_CANONICAL_URL);
    expect(RHYTHMIC_COLOUR_TOP_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/rhythmic-colour-top",
    );
    expect(RHYTHMIC_COLOUR_TOP_TITLE).toBe("Rhythmic Colour Top");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.title).toBe(RHYTHMIC_COLOUR_TOP_TITLE);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.description).toBe(RHYTHMIC_COLOUR_TOP_DESCRIPTION);
    expect(templateSource).toContain("`${content.title} | Knit it Now`");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["rhythmic-colour-top"]).toBeUndefined();
    expect(RHYTHMIC_COLOUR_TOP_PAGE.lessons).toBeUndefined();
    expect(RHYTHMIC_COLOUR_TOP_PAGE.palette).toBeUndefined();
    expect(KNIT_ABLES_CARDS[0]?.href).toBe(RHYTHMIC_COLOUR_TOP_PATH);
    expect(KNIT_ABLES_CARDS[0]?.title).toBe(RHYTHMIC_COLOUR_TOP_TITLE);
    expect(KNIT_ABLES_CARDS[0]?.description).toBe(RHYTHMIC_COLOUR_TOP_CARD_COPY);
    expect(KNIT_ABLES_CARDS[0]?.image.src).toBe(RHYTHMIC_COLOUR_TOP_IMAGES.hero.src);
  });

  it("uses the existing thumbnail for the hero and catalog card", () => {
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.src).toBe("/images/knit-ables/rhythmic-color.jpg");
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.fileName).toBe("rhythmic-color.jpg");
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.width).toBe(460);
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.height).toBe(602);
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.alt).toContain("crochet top");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.hero.src).toBe(RHYTHMIC_COLOUR_TOP_IMAGES.hero.src);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.hero.href).toBe(RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL);
    expect(existsSync(resolve(`public${RHYTHMIC_COLOUR_TOP_IMAGES.hero.src}`))).toBe(true);
    expect(RHYTHMIC_COLOUR_TOP_IMAGES.hero.src).not.toMatch(/^https?:/);
    expect(pageSource).not.toContain("sirdar.com");
    expect(templateSource).not.toContain("rhythmic-colour-top");
    expect(templateSource).not.toContain("rhythmic-color");
  });

  it("keeps the inspiration copy in the shared page sections", () => {
    expect(RHYTHMIC_COLOUR_TOP_TAGLINE).toBe(
      "Crochet Inspiration. Machine Knitting Possibilities!",
    );
    expect(RHYTHMIC_COLOUR_TOP_PAGE.tagline).toBe(RHYTHMIC_COLOUR_TOP_TAGLINE);
    expect(RHYTHMIC_COLOUR_TOP_INTRO).toEqual([
      "Yes, this is crochet! But take a closer look.",
      "Sirdar's Rhythmic Colour Top is a wonderful example of how working sideways can create a striking garment, especially when you let the yarn do the colorwork.",
    ]);
    expect(knitAbleInspirationIntroParagraphs(RHYTHMIC_COLOUR_TOP_PAGE.intro)).toEqual([
      ...RHYTHMIC_COLOUR_TOP_INTRO,
    ]);
    expect(RHYTHMIC_COLOUR_TOP_BUILDER_HEADING).toBe("Make It Your Own");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.heading).toBe(RHYTHMIC_COLOUR_TOP_BUILDER_HEADING);
    expect(RHYTHMIC_COLOUR_TOP_BUILDER_COPY_BEFORE).toBe("And here's the fun part! Use the ");
    expect(RHYTHMIC_COLOUR_TOP_BUILDER_LINK_LABEL).toBe(
      "Knit It Now Sideways V-Neck Sweater Builder",
    );
    expect(RHYTHMIC_COLOUR_TOP_BUILDER_COPY_AFTER).toBe(" to create your own version.");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.introduction).toEqual({
      before: RHYTHMIC_COLOUR_TOP_BUILDER_COPY_BEFORE,
      link: {
        label: RHYTHMIC_COLOUR_TOP_BUILDER_LINK_LABEL,
        href: rhythmicColourTopLandingHref(),
      },
      after: RHYTHMIC_COLOUR_TOP_BUILDER_COPY_AFTER,
    });
    expect(RHYTHMIC_COLOUR_TOP_BUILD_STEPS).toEqual([
      { lead: "Pullover or cardigan?", text: "You choose!" },
      { lead: "Sleeves or sleeveless?", text: "Knit the sleeves or simply leave them off." },
      { lead: "Love those colors?", text: "Let a self-striping yarn do the work." },
      { lead: "Make it fit YOU!", text: "Your measurements. Your gauge." },
    ]);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.steps).toEqual(RHYTHMIC_COLOUR_TOP_BUILD_STEPS);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.closing).toEqual([
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_HEADING, heading: true },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_INTRO },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_BODY },
      { text: RHYTHMIC_COLOUR_TOP_CROCHET_CHOICE, strong: true },
      { text: RHYTHMIC_COLOUR_TOP_ANY_YARN, emphasis: true },
    ]);
    expect(RHYTHMIC_COLOUR_TOP_CROCHET_HEADING).toBe("Do You Crochet?");
    expect(RHYTHMIC_COLOUR_TOP_CROCHET_INTRO).toBe("Why not combine the best of both worlds?");
    expect(RHYTHMIC_COLOUR_TOP_CROCHET_BODY).toBe(
      "Machine knit your sideways sweater, then add a crochet edging to the neckline, armholes, or front edges.",
    );
    expect(RHYTHMIC_COLOUR_TOP_CROCHET_CHOICE).toBe("Who says you have to choose?");
    expect(RHYTHMIC_COLOUR_TOP_ANY_YARN).toBe("Any yarn. Any machine. Your size. Your style.");
    expect(RHYTHMIC_COLOUR_TOP_INSPIRED_HEADING).toBe("Inspired by Rhythmic Colour");
    expect(RHYTHMIC_COLOUR_TOP_INSPIRED_COPY).toBe(
      "This is inspiration, not a pattern conversion. Use the Sirdar design for ideas and the Knit It Now Builder to create your own sweater.",
    );
    expect(RHYTHMIC_COLOUR_TOP_PAGE.pattern.copy).toBe(RHYTHMIC_COLOUR_TOP_INSPIRED_COPY);
    expect(RHYTHMIC_COLOUR_TOP_YARN.paragraphs).toEqual([
      "Love the color changes? Explore Sirdar Jewelspun Aran or choose your own colorful yarn. Swatch on your machine and let YOUR gauge guide the pattern.",
    ]);
    expect(templateSource).toContain("<strong>{item.lead}</strong>");
    expect(templateSource).toContain("knit-able-builder-subhead");
    expect(templateSource).toContain('typeof item === "string"');
  });

  it("opens the Sideways V-Neck Sweater landing page from the primary CTA", () => {
    expect(existsSync(resolve("src/pages/patterns/sideways-cardigan/index.astro"))).toBe(true);
    expect(sidewaysLandingPage).toContain("SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING");
    expect(rhythmicColourTopLandingHref()).toBe("/patterns/sideways-cardigan");
    expect(rhythmicColourTopLandingHref()).toBe(SIDEWAYS_KNIT_SWEATER_PATTERN_LANDING_PATH);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.introduction.link?.href).toBe(
      rhythmicColourTopLandingHref(),
    );
    expect(RHYTHMIC_COLOUR_TOP_CTA_LABEL).toBe("Create Your Own Sideways Sweater");
    expect(RHYTHMIC_COLOUR_TOP_CTA.memberLabel).toBe(RHYTHMIC_COLOUR_TOP_CTA_LABEL);
    expect(RHYTHMIC_COLOUR_TOP_CTA.memberHref).toBe(rhythmicColourTopLandingHref());
    expect(RHYTHMIC_COLOUR_TOP_CTA.memberHref).not.toBe(buildSidewaysCardiganBuilderNewPatternHref());
    expect(RHYTHMIC_COLOUR_TOP_CTA.prospectLabel).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.prospectLabel,
    );
    expect(RHYTHMIC_COLOUR_TOP_CTA.prospectHref).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.prospectHref,
    );
    expect(RHYTHMIC_COLOUR_TOP_CTA.signInLabel).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.signInLabel,
    );
    expect(RHYTHMIC_COLOUR_TOP_CTA.checkingLabel).toBe(
      SIDEWAYS_KNIT_SWEATER_PATTERN_BUILDER_LANDING.cta.checkingLabel,
    );
    expect(RHYTHMIC_COLOUR_TOP_PAGE.builder.cta).toBe(RHYTHMIC_COLOUR_TOP_CTA);
    expect(pageSource).not.toContain("/patterns/sideways-cardigan");
    expect(templateSource).toContain("initPatternBuilderLandingCta");
    expect(templateSource).toContain("kbm-btn kbm-btn-accent");
  });

  it("opens the pattern and yarn pages through the supplied Awin affiliate links", () => {
    expect(RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2F%2Fen%2Fproducts%2F10923-rhythmic-colour-crochet-top-crochet-pattern-in-sirdar-jewelspun-ombre",
    );
    expect(RHYTHMIC_COLOUR_TOP_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2F%2Fen%2Fproducts%2Fsirdar-jewelspun-aran-200g",
    );
    expect(RHYTHMIC_COLOUR_TOP_PATTERN_LINK_LABEL).toBe("View the Original Crochet Pattern");
    expect(RHYTHMIC_COLOUR_TOP_PAGE.pattern.linkLabel).toBe(RHYTHMIC_COLOUR_TOP_PATTERN_LINK_LABEL);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.pattern.href).toBe(RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.hero.href).toBe(RHYTHMIC_COLOUR_TOP_ORIGINAL_PATTERN_URL);
    expect(RHYTHMIC_COLOUR_TOP_YARN_HEADING).toBe("Yarn Inspiration");
    expect(RHYTHMIC_COLOUR_TOP_YARN.heading).toBe("Sirdar Jewelspun Aran");
    expect(RHYTHMIC_COLOUR_TOP_YARN.buttonLabel).toBe("Explore Sirdar Jewelspun Aran");
    expect(RHYTHMIC_COLOUR_TOP_YARN.href).toBe(RHYTHMIC_COLOUR_TOP_YARN_URL);
    expect(RHYTHMIC_COLOUR_TOP_PAGE.yarn).toMatchObject({
      heading: RHYTHMIC_COLOUR_TOP_YARN_HEADING,
      cardHeading: RHYTHMIC_COLOUR_TOP_YARN.heading,
      buttonLabel: RHYTHMIC_COLOUR_TOP_YARN.buttonLabel,
      href: RHYTHMIC_COLOUR_TOP_YARN_URL,
    });
    expect(RHYTHMIC_COLOUR_TOP_PAGE.yarn.image).toBeUndefined();
    expect(RHYTHMIC_COLOUR_TOP_AFFILIATE_DISCLOSURE).toBe(
      "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.",
    );
    expect(RHYTHMIC_COLOUR_TOP_PAGE.affiliateDisclosure).toBe(
      RHYTHMIC_COLOUR_TOP_AFFILIATE_DISCLOSURE,
    );
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(templateSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(templateSource).toContain('target="_blank"');
    expect(pageSource).not.toContain("awin1.com");
  });

  it("keeps this Knit-able's copy out of the shared template and the earlier pages", () => {
    expect(templateSource).not.toContain("Rhythmic Colour");
    expect(templateSource).not.toContain("Jewelspun Aran");
    expect(capSleevePage).not.toContain("rhythmic-colour-top");
    expect(cocoLocoPage).not.toContain("rhythmic-colour-top");
    expect(teenageKicksPage).not.toContain("rhythmic-colour-top");
    expect(worstedPage).not.toContain("rhythmic-colour-top");
    expect(capSleevePage).not.toContain("Rhythmic Colour");
    expect(cocoLocoPage).not.toContain("Rhythmic Colour");
  });
});
