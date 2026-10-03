import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import videosRaw from "../../data/videos-public.json";
import { findPublicCatalogVideoByContentId } from "../videoPublic";
import { buildSleevelessBuilderNewPatternHref } from "../patterns/patternStorage";
import {
  SLEEVELESS_PATTERN_BUILDER_LANDING,
  SLEEVELESS_PATTERN_LANDING_PATH,
} from "../patterns/sleevelessPatternLanding";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import {
  knitAbleInspirationLessonContentId,
  knitAbleInspirationSwatches,
} from "./inspirationPage";
import {
  COCO_LOCO_TANK_AFFILIATE_DISCLOSURE,
  COCO_LOCO_TANK_ANY_YARN,
  COCO_LOCO_TANK_BUILD_STEPS,
  COCO_LOCO_TANK_BUILDER_COPY_AFTER,
  COCO_LOCO_TANK_BUILDER_COPY_BEFORE,
  COCO_LOCO_TANK_BUILDER_HEADING,
  COCO_LOCO_TANK_BUILDER_LINK_LABEL,
  COCO_LOCO_TANK_CANONICAL_URL,
  COCO_LOCO_TANK_CARD_COPY,
  COCO_LOCO_TANK_CTA,
  COCO_LOCO_TANK_IMAGES,
  COCO_LOCO_TANK_INSPIRED_COPY,
  COCO_LOCO_TANK_INSPIRED_HEADING,
  COCO_LOCO_TANK_INTRO,
  COCO_LOCO_TANK_INTRO_LEAD,
  COCO_LOCO_TANK_MEMBER_LESSON_ACCESS_LABEL,
  COCO_LOCO_TANK_MEMBER_LESSONS,
  COCO_LOCO_TANK_MEMBER_LESSONS_HEADING,
  COCO_LOCO_TANK_MEMBER_LESSONS_INTRO,
  COCO_LOCO_TANK_ORIGINAL_PATTERN_URL,
  COCO_LOCO_TANK_PAGE,
  COCO_LOCO_TANK_PALETTE,
  COCO_LOCO_TANK_PATH,
  COCO_LOCO_TANK_PATTERN_LINK_LABEL,
  COCO_LOCO_TANK_STRIPE_NOTE,
  COCO_LOCO_TANK_TITLE,
  COCO_LOCO_TANK_YARN,
  COCO_LOCO_TANK_YARN_HEADING,
  COCO_LOCO_TANK_YARN_URL,
  cocoLocoTankBuilderHref,
  cocoLocoTankLandingHref,
} from "./cocoLocoTank";

const pageSource = readFileSync(resolve("src/pages/knit-ables/coco-loco-tank.astro"), "utf8");
const templateSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleInspirationPage.astro"),
  "utf8",
);
const sleevelessLandingPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/index.astro"),
  "utf8",
);
const sleevelessBuilderPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const capSleevePage = readFileSync(resolve("src/pages/knit-ables/cap-sleeve-tank.astro"), "utf8");
const teenageKicksPage = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const worstedPage = readFileSync(
  resolve("src/pages/knit-ables/worsted-color-block-socks.astro"),
  "utf8",
);

describe("Coco Loco Tank Knit-able page", () => {
  it("is a server-rendered page at the Knit-able route", () => {
    expect(COCO_LOCO_TANK_PATH).toBe("/knit-ables/coco-loco-tank");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: COCO_LOCO_TANK_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("KnitAbleInspirationPage");
    expect(pageSource).toContain("content={COCO_LOCO_TANK_PAGE}");
    expect(COCO_LOCO_TANK_PAGE.canonicalUrl).toBe(COCO_LOCO_TANK_CANONICAL_URL);
    expect(COCO_LOCO_TANK_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/coco-loco-tank",
    );
    expect(COCO_LOCO_TANK_TITLE).toBe("Coco Loco Tank");
    expect(COCO_LOCO_TANK_PAGE.title).toBe(COCO_LOCO_TANK_TITLE);
    expect(templateSource).toContain("content.canonicalUrl");
    expect(templateSource).toContain("content.title");
    expect(templateSource).toContain("KnitAblePageHeader");
    expect(pageSource).not.toContain("SleevelessPatternMemberGate");
    expect(templateSource).not.toContain("SleevelessPatternMemberGate");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["coco-loco-tank"]).toBeUndefined();
  });

  it("uses the supplied thumbnail with descriptive alt text", () => {
    expect(COCO_LOCO_TANK_IMAGES.hero.src).toBe("/images/knit-ables/coco-loco-tank.jpg");
    expect(COCO_LOCO_TANK_IMAGES.hero.fileName).toBe("coco-loco-tank.jpg");
    expect(COCO_LOCO_TANK_IMAGES.hero.width).toBe(750);
    expect(COCO_LOCO_TANK_IMAGES.hero.height).toBe(1000);
    expect(COCO_LOCO_TANK_IMAGES.hero.alt).toContain("sleeveless tank");
    expect(COCO_LOCO_TANK_IMAGES.hero.alt).toContain("stripes");
    expect(COCO_LOCO_TANK_PAGE.hero.src).toBe(COCO_LOCO_TANK_IMAGES.hero.src);
    expect(COCO_LOCO_TANK_PAGE.hero.alt).toBe(COCO_LOCO_TANK_IMAGES.hero.alt);
    expect(existsSync(resolve(`public${COCO_LOCO_TANK_IMAGES.hero.src}`))).toBe(true);
    expect(templateSource).toContain("content.hero.src");
    expect(templateSource).toContain("content.hero.alt");
    expect(templateSource).toContain("max-width: 20rem");
  });

  it("keeps the intro and builder section copy", () => {
    expect(COCO_LOCO_TANK_INTRO_LEAD).toBe("Simple shape. Playful stripes. Your machine.");
    expect(COCO_LOCO_TANK_PAGE.tagline).toBe(COCO_LOCO_TANK_INTRO_LEAD);
    expect(COCO_LOCO_TANK_INTRO).toContain("Twin Stitches Designs");
    expect(COCO_LOCO_TANK_PAGE.intro).toBe(COCO_LOCO_TANK_INTRO);
    expect(COCO_LOCO_TANK_BUILDER_HEADING).toBe(
      "Make it yours with the KIN Sleeveless builder",
    );
    expect(COCO_LOCO_TANK_PAGE.builder.heading).toBe(COCO_LOCO_TANK_BUILDER_HEADING);
    expect(COCO_LOCO_TANK_BUILDER_LINK_LABEL).toBe("Knit It Now Sleeveless builder");
    expect(COCO_LOCO_TANK_PAGE.builder.introduction.link?.label).toBe(
      COCO_LOCO_TANK_BUILDER_LINK_LABEL,
    );
    expect(COCO_LOCO_TANK_BUILDER_COPY_BEFORE).toBe("Use the ");
    expect(COCO_LOCO_TANK_PAGE.builder.introduction.before).toBe(
      COCO_LOCO_TANK_BUILDER_COPY_BEFORE,
    );
    expect(COCO_LOCO_TANK_BUILDER_COPY_AFTER).toBe(
      " to create your basic tank, then add your own stripe arrangement.",
    );
    expect(COCO_LOCO_TANK_PAGE.builder.introduction.after).toBe(
      COCO_LOCO_TANK_BUILDER_COPY_AFTER,
    );
    expect(COCO_LOCO_TANK_BUILD_STEPS).toEqual([
      "Choose your size and preferred fit.",
      "Adjust the length to suit your style.",
      "Swatch your yarn and enter your stitch and row gauge.",
      "Choose a main color and add contrasting stripes.",
    ]);
    expect(COCO_LOCO_TANK_PAGE.builder.steps).toEqual(COCO_LOCO_TANK_BUILD_STEPS);
    expect(COCO_LOCO_TANK_STRIPE_NOTE).toContain("leftover yarn");
    expect(COCO_LOCO_TANK_ANY_YARN).toBe("Any yarn. Any machine. Your creativity.");
    expect(COCO_LOCO_TANK_PAGE.builder.closing).toEqual([
      { text: COCO_LOCO_TANK_STRIPE_NOTE },
      { text: COCO_LOCO_TANK_ANY_YARN, emphasis: true },
    ]);
    expect(templateSource).toContain("knit-able-steps");
    expect(templateSource).toContain("padding-left: 24px");
    expect(templateSource).toContain("knit-able-builder");
    expect(templateSource).not.toContain("knit-able-checklist");
    expect(COCO_LOCO_TANK_CARD_COPY).toBe(
      "Use the Knit It Now Sleeveless builder to create a basic tank, then add your own stripe arrangement.",
    );
  });

  it("links the landing page and uses the Sleeveless member and visitor actions", () => {
    expect(existsSync(resolve("src/pages/patterns/sleeveless/index.astro"))).toBe(true);
    expect(existsSync(resolve("src/pages/patterns/sleeveless/builder.astro"))).toBe(true);
    expect(sleevelessLandingPage).toContain("SLEEVELESS_PATTERN_BUILDER_LANDING");
    expect(sleevelessBuilderPage).toContain("SleevelessPatternMemberGate");
    expect(cocoLocoTankLandingHref()).toBe("/patterns/sleeveless");
    expect(cocoLocoTankLandingHref()).toBe(SLEEVELESS_PATTERN_LANDING_PATH);
    expect(COCO_LOCO_TANK_PAGE.builder.introduction.link?.href).toBe(cocoLocoTankLandingHref());
    expect(cocoLocoTankBuilderHref()).toBe("/patterns/sleeveless/builder?new=1");
    expect(cocoLocoTankBuilderHref()).toBe(buildSleevelessBuilderNewPatternHref());
    expect(COCO_LOCO_TANK_CTA).toBe(SLEEVELESS_PATTERN_BUILDER_LANDING.cta);
    expect(COCO_LOCO_TANK_PAGE.builder.cta).toBe(COCO_LOCO_TANK_CTA);
    expect(COCO_LOCO_TANK_CTA.memberHref).toBe(cocoLocoTankBuilderHref());
    expect(COCO_LOCO_TANK_CTA.memberLabel).toBe("Create My Pattern");
    expect(COCO_LOCO_TANK_CTA.prospectLabel).toBe("Become a Member");
    expect(COCO_LOCO_TANK_CTA.prospectHref).toBe("/membership");
    expect(COCO_LOCO_TANK_CTA.signInLabel).toBe("Already a member? Sign in");
    expect(templateSource).toContain("content.builder.cta.memberHref");
    expect(templateSource).toContain("content.builder.cta.prospectHref");
    expect(templateSource).toContain('data-ms-modal="login"');
    expect(templateSource).toContain("initPatternBuilderLandingCta");
    expect(templateSource).toContain("data-pattern-builder-landing-cta-member");
    expect(templateSource).toContain("data-pattern-builder-landing-cta-prospect");
    expect(SLEEVELESS_PATTERN_BUILDER_LANDING.knitAble).toBeUndefined();
  });

  it("opens the pattern and yarn pages through the supplied Awin affiliate links", () => {
    expect(COCO_LOCO_TANK_ORIGINAL_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fcoco-loco-tank-knitting-pattern%2Fp%2FN9181",
    );
    expect(COCO_LOCO_TANK_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fmellizas-sock-yarn%2Fc%2F5420534",
    );
    expect(COCO_LOCO_TANK_YARN.href).toBe(COCO_LOCO_TANK_YARN_URL);
    expect(COCO_LOCO_TANK_PAGE.pattern.href).toBe(COCO_LOCO_TANK_ORIGINAL_PATTERN_URL);
    expect(COCO_LOCO_TANK_PAGE.yarn.href).toBe(COCO_LOCO_TANK_YARN.href);
    expect(COCO_LOCO_TANK_YARN.buttonLabel).toBe("Explore Mellizas yarn and colors");
    expect(COCO_LOCO_TANK_PATTERN_LINK_LABEL).toBe(
      "Explore the Coco Loco hand knitting pattern",
    );
    expect(COCO_LOCO_TANK_INSPIRED_HEADING).toBe("Inspired by Coco Loco");
    expect(COCO_LOCO_TANK_INSPIRED_COPY).toContain("hand knitting pattern");
    expect(COCO_LOCO_TANK_YARN_HEADING).toBe("Yarn inspiration");
    expect(COCO_LOCO_TANK_YARN.paragraphs.join(" ")).toContain("Knit Picks Mellizas");
    expect(COCO_LOCO_TANK_AFFILIATE_DISCLOSURE).toBe(
      "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.",
    );
    expect(COCO_LOCO_TANK_PAGE.affiliateDisclosure).toBe(COCO_LOCO_TANK_AFFILIATE_DISCLOSURE);
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(templateSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(templateSource).toContain('target="_blank"');
    expect(templateSource).toContain("rel={patternRel}");
    expect(templateSource).toContain("content.pattern.href");
    expect(templateSource).toContain("content.yarn.href");
    expect(templateSource).not.toContain("https://www.knitpicks.com/");
    expect(pageSource).not.toContain("https://www.knitpicks.com/");
  });

  it("keeps Coco Loco details in data and leaves the earlier Knit-able pages unchanged", () => {
    expect(pageSource).not.toContain("worksheet");
    expect(templateSource).not.toContain("Coco Loco");
    expect(templateSource).not.toContain("coco-loco");
    expect(templateSource).not.toContain("Mellizas");
    expect(templateSource).not.toContain("#e56b93");
    expect(capSleevePage).not.toContain("coco-loco-tank");
    expect(capSleevePage).not.toContain("KnitAbleInspirationPage");
    expect(teenageKicksPage).not.toContain("coco-loco-tank");
    expect(teenageKicksPage).not.toContain("KnitAbleInspirationPage");
    expect(worstedPage).not.toContain("coco-loco-tank");
    expect(worstedPage).not.toContain("Coco Loco");
    expect(worstedPage).not.toContain("KnitAbleInspirationPage");
  });

  it("lists member lessons in a collapsed disclosure before the affiliate note", () => {
    expect(COCO_LOCO_TANK_MEMBER_LESSONS_HEADING).toBe("Helpful member lessons");
    expect(COCO_LOCO_TANK_MEMBER_LESSONS_INTRO).toBe(
      "Two videos to help you explore stripe ideas and keep your seams looking neat.",
    );
    expect(COCO_LOCO_TANK_MEMBER_LESSON_ACCESS_LABEL).toBe("Members");
    expect(COCO_LOCO_TANK_MEMBER_LESSONS).toEqual([
      {
        title: "Perfect Jog-less Stripes",
        description: "Keep your stripes aligned when seaming your tank.",
        href: "/videos/597",
      },
      {
        title: "Yipes Stripes",
        description: "Explore more possibilities with stripes and vertical textures.",
        href: "/videos/442",
      },
    ]);
    expect(COCO_LOCO_TANK_PAGE.lessons?.items).toEqual(COCO_LOCO_TANK_MEMBER_LESSONS);
    expect(COCO_LOCO_TANK_PALETTE.label).toBe("Color inspiration");
    expect(COCO_LOCO_TANK_PALETTE.caption).toBe("Choose your own combination.");
    expect(knitAbleInspirationSwatches(COCO_LOCO_TANK_PALETTE)).toEqual([
      { color: "#e56b93", bordered: false },
      { color: "#b5d44a", bordered: false },
      { color: "#f08a3c", bordered: false },
      { color: "#f6f3ee", bordered: true },
    ]);

    const inspiredAt = templateSource.indexOf('id="knit-able-source-heading"');
    const yarnAt = templateSource.indexOf('id="knit-able-yarn-heading"');
    const disclosureAt = templateSource.lastIndexOf("knit-able-affiliate");
    const lessonsAt = templateSource.indexOf("data-help-hub-lessons");
    expect(inspiredAt).toBeGreaterThan(-1);
    expect(yarnAt).toBeGreaterThan(inspiredAt);
    expect(lessonsAt).toBeGreaterThan(yarnAt);
    expect(disclosureAt).toBeGreaterThan(lessonsAt);
    expect(templateSource).toContain("lessonsIntro");
    expect(templateSource).toContain("Show lessons ({lessons.items.length})");
    expect(templateSource).toContain("Hide lessons");
    const leadAt = templateSource.indexOf("knit-able-lead");
    const paletteAt = templateSource.indexOf('class="knit-able-palette"');
    const introAt = templateSource.indexOf("<p>{content.intro}</p>");
    const paletteSource = templateSource.slice(paletteAt, introAt);
    expect(leadAt).toBeGreaterThan(-1);
    expect(paletteAt).toBeGreaterThan(leadAt);
    expect(introAt).toBeGreaterThan(paletteAt);
    expect(paletteSource).toContain("paletteLabel");
    expect(paletteSource).toContain("paletteCaption");
    expect(paletteSource).toContain("knit-able-palette__swatch");
    expect(paletteSource).not.toContain("<a ");
    expect(paletteSource).not.toContain("<button");
    expect(templateSource).toContain("width: 36px");
    expect(templateSource).toContain("gap: 8px");
    expect(templateSource).not.toContain("knit-able-stripes");
    expect(templateSource).toContain("flex-direction: row");
    expect(templateSource).toContain('<details class="knit-able-lessons-disclosure">');
    expect(templateSource).not.toContain("<details open");

    const lessonsSource = templateSource.slice(
      templateSource.indexOf('<details class="knit-able-lessons-disclosure">'),
      templateSource.indexOf("</details>"),
    );
    expect(lessonsSource).toContain("knit-able-member-resource");
    expect(lessonsSource).toContain("knit-able-member-resource__label");
    expect(lessonsSource).toContain("data-help-hub-lessons");
    expect(lessonsSource).toContain("data-help-hub-lesson-return={content.path}");
    expect(lessonsSource).toContain("data-help-hub-lesson-open");
    expect(lessonsSource).toContain("data-help-hub-lesson-modal");
    expect(lessonsSource).toContain("data-help-hub-lesson-close");
    expect(lessonsSource).toContain("data-hh-lesson-gate");
    expect(lessonsSource).toContain("data-lesson-href={lesson.href}");
    expect(lessonsSource).toContain('role="dialog"');
    expect(lessonsSource).not.toContain("<a href={lesson.href}>");
    expect(lessonsSource).not.toContain('target="_blank"');
    expect(templateSource).toContain("bootHelpHubMemberLessonGates");
    expect(knitAbleInspirationLessonContentId("/videos/597")).toBe("597");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["coco-loco-tank"]).toBeUndefined();

    for (const lesson of COCO_LOCO_TANK_MEMBER_LESSONS) {
      const contentId = lesson.href.replace("/videos/", "");
      const video = findPublicCatalogVideoByContentId(videosRaw, contentId) as {
        access_level?: string;
      } | null;
      expect(video?.access_level).toBe("member");
    }
  });
});
