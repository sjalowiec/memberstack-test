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
    expect(pageSource).toContain("COCO_LOCO_TANK_CANONICAL_URL");
    expect(COCO_LOCO_TANK_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/coco-loco-tank",
    );
    expect(COCO_LOCO_TANK_TITLE).toBe("Coco Loco Tank");
    expect(pageSource).toContain("COCO_LOCO_TANK_TITLE");
    expect(pageSource).toContain("KnitAblePageHeader");
    expect(pageSource).not.toContain("SleevelessPatternMemberGate");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["coco-loco-tank"]).toBeUndefined();
  });

  it("uses the supplied thumbnail with descriptive alt text", () => {
    expect(COCO_LOCO_TANK_IMAGES.hero.src).toBe("/images/knit-ables/coco-loco-tank.jpg");
    expect(COCO_LOCO_TANK_IMAGES.hero.fileName).toBe("coco-loco-tank.jpg");
    expect(COCO_LOCO_TANK_IMAGES.hero.width).toBe(750);
    expect(COCO_LOCO_TANK_IMAGES.hero.height).toBe(1000);
    expect(COCO_LOCO_TANK_IMAGES.hero.alt).toContain("sleeveless tank");
    expect(COCO_LOCO_TANK_IMAGES.hero.alt).toContain("stripes");
    expect(existsSync(resolve(`public${COCO_LOCO_TANK_IMAGES.hero.src}`))).toBe(true);
    expect(pageSource).toContain("heroImage.src");
    expect(pageSource).toContain("heroImage.alt");
    expect(pageSource).toContain("max-width: 20rem");
  });

  it("keeps the intro and builder section copy", () => {
    expect(COCO_LOCO_TANK_INTRO_LEAD).toBe("Simple shape. Playful stripes. Your machine.");
    expect(COCO_LOCO_TANK_INTRO).toContain("Twin Stitches Designs");
    expect(COCO_LOCO_TANK_BUILDER_HEADING).toBe(
      "Make it yours with the KIN Sleeveless builder",
    );
    expect(COCO_LOCO_TANK_BUILDER_LINK_LABEL).toBe("Knit It Now Sleeveless builder");
    expect(COCO_LOCO_TANK_BUILDER_COPY_BEFORE).toBe("Use the ");
    expect(COCO_LOCO_TANK_BUILDER_COPY_AFTER).toBe(
      " to create your basic tank, then add your own stripe arrangement.",
    );
    expect(COCO_LOCO_TANK_BUILD_STEPS).toEqual([
      "Choose your size and preferred fit.",
      "Adjust the length to suit your style.",
      "Swatch your yarn and enter your stitch and row gauge.",
      "Choose a main color and add contrasting stripes.",
    ]);
    expect(COCO_LOCO_TANK_STRIPE_NOTE).toContain("leftover yarn");
    expect(COCO_LOCO_TANK_ANY_YARN).toBe("Any yarn. Any machine. Your creativity.");
    expect(pageSource).toContain("knit-able-steps");
    expect(pageSource).toContain("padding-left: 24px");
    expect(pageSource).toContain("knit-able-builder");
    expect(pageSource).not.toContain("knit-able-checklist");
    expect(pageSource).toContain("COCO_LOCO_TANK_BUILD_STEPS");
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
    expect(cocoLocoTankBuilderHref()).toBe("/patterns/sleeveless/builder?new=1");
    expect(cocoLocoTankBuilderHref()).toBe(buildSleevelessBuilderNewPatternHref());
    expect(COCO_LOCO_TANK_CTA).toBe(SLEEVELESS_PATTERN_BUILDER_LANDING.cta);
    expect(COCO_LOCO_TANK_CTA.memberHref).toBe(cocoLocoTankBuilderHref());
    expect(COCO_LOCO_TANK_CTA.memberLabel).toBe("Create My Pattern");
    expect(COCO_LOCO_TANK_CTA.prospectLabel).toBe("Become a Member");
    expect(COCO_LOCO_TANK_CTA.prospectHref).toBe("/membership");
    expect(COCO_LOCO_TANK_CTA.signInLabel).toBe("Already a member? Sign in");
    expect(pageSource).toContain("href={landingHref}");
    expect(pageSource).toContain("COCO_LOCO_TANK_CTA.memberHref");
    expect(pageSource).toContain("COCO_LOCO_TANK_CTA.prospectHref");
    expect(pageSource).toContain('data-ms-modal="login"');
    expect(pageSource).toContain("initPatternBuilderLandingCta");
    expect(pageSource).toContain('data-pattern-builder-landing-cta-member');
    expect(pageSource).toContain('data-pattern-builder-landing-cta-prospect');
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
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(pageSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("rel={KNIT_ABLE_AFFILIATE_REL}");
    expect(pageSource).toContain("href={COCO_LOCO_TANK_ORIGINAL_PATTERN_URL}");
    expect(pageSource).toContain("href={COCO_LOCO_TANK_YARN.href}");
    expect(pageSource).toContain("COCO_LOCO_TANK_AFFILIATE_DISCLOSURE");
    expect(pageSource).not.toContain("https://www.knitpicks.com/");
  });

  it("does not add a worksheet or changes to the earlier Knit-able pages", () => {
    expect(pageSource).not.toContain("worksheet");
    expect(capSleevePage).not.toContain("coco-loco-tank");
    expect(teenageKicksPage).not.toContain("coco-loco-tank");
    expect(worstedPage).not.toContain("coco-loco-tank");
    expect(worstedPage).not.toContain("Coco Loco");
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

    const inspiredAt = pageSource.indexOf('id="knit-able-source-heading"');
    const yarnAt = pageSource.indexOf('id="knit-able-yarn-heading"');
    const disclosureAt = pageSource.lastIndexOf("COCO_LOCO_TANK_AFFILIATE_DISCLOSURE");
    const lessonsAt = pageSource.indexOf("data-help-hub-lessons");
    expect(inspiredAt).toBeGreaterThan(-1);
    expect(yarnAt).toBeGreaterThan(inspiredAt);
    expect(lessonsAt).toBeGreaterThan(yarnAt);
    expect(disclosureAt).toBeGreaterThan(lessonsAt);
    expect(pageSource).toContain("COCO_LOCO_TANK_MEMBER_LESSONS_INTRO");
    expect(pageSource).toContain("Show lessons ({COCO_LOCO_TANK_MEMBER_LESSONS.length})");
    expect(pageSource).toContain("Hide lessons");
    const leadAt = pageSource.indexOf("knit-able-lead");
    const paletteAt = pageSource.indexOf('class="knit-able-palette"');
    const introAt = pageSource.indexOf("<p>{COCO_LOCO_TANK_INTRO}</p>");
    const paletteSource = pageSource.slice(paletteAt, introAt);
    expect(leadAt).toBeGreaterThan(-1);
    expect(paletteAt).toBeGreaterThan(leadAt);
    expect(introAt).toBeGreaterThan(paletteAt);
    expect(paletteSource).toContain("Color inspiration");
    expect(paletteSource).toContain("Choose your own combination.");
    expect(paletteSource.match(/knit-able-palette__swatch--/g)).toHaveLength(4);
    expect(paletteSource).not.toContain("<a ");
    expect(paletteSource).not.toContain("<button");
    expect(pageSource).toContain("width: 36px");
    expect(pageSource).toContain("gap: 8px");
    expect(pageSource).not.toContain("knit-able-stripes");
    expect(pageSource).toContain("flex-direction: row");
    expect(pageSource).toContain('<details class="knit-able-lessons-disclosure">');
    expect(pageSource).not.toContain("<details open");

    const lessonsSource = pageSource.slice(
      pageSource.indexOf('<details class="knit-able-lessons-disclosure">'),
      pageSource.indexOf("</details>"),
    );
    expect(lessonsSource).toContain("knit-able-member-resource");
    expect(lessonsSource).toContain("knit-able-member-resource__label");
    expect(lessonsSource).toContain("data-help-hub-lessons");
    expect(lessonsSource).toContain("data-help-hub-lesson-return={COCO_LOCO_TANK_PATH}");
    expect(lessonsSource).toContain("data-help-hub-lesson-open");
    expect(lessonsSource).toContain("data-help-hub-lesson-modal");
    expect(lessonsSource).toContain("data-help-hub-lesson-close");
    expect(lessonsSource).toContain("data-hh-lesson-gate");
    expect(lessonsSource).toContain("data-lesson-href={lesson.href}");
    expect(lessonsSource).toContain('role="dialog"');
    expect(lessonsSource).not.toContain("<a href={lesson.href}>");
    expect(lessonsSource).not.toContain('target="_blank"');
    expect(pageSource).toContain("bootHelpHubMemberLessonGates");
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
