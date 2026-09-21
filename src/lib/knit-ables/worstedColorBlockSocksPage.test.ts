import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSockBuilderNewPatternHref } from "../patterns/sock/sockFreshStart";
import { SOCKS_PATTERN_BUILDER_LANDING } from "../patterns/socksPatternLanding";
import { KNIT_ABLE_AFFILIATE_REL, knitAbleSockBuilderHref } from "./links";
import { TEENAGE_KICKS_SOCKS_PATH } from "./teenageKicksSocks";
import {
  WORSTED_COLOR_BLOCK_SOCKS_BUILD_STEPS,
  WORSTED_COLOR_BLOCK_SOCKS_CANONICAL_URL,
  WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY,
  WORSTED_COLOR_BLOCK_SOCKS_COLOR_IDEAS,
  WORSTED_COLOR_BLOCK_SOCKS_HERO_COPY,
  WORSTED_COLOR_BLOCK_SOCKS_IMAGES,
  WORSTED_COLOR_BLOCK_SOCKS_ORIGINAL_PATTERN_URL,
  WORSTED_COLOR_BLOCK_SOCKS_PATH,
  WORSTED_COLOR_BLOCK_SOCKS_TITLE,
  WORSTED_COLOR_BLOCK_SOCKS_YARN,
  WORSTED_COLOR_BLOCK_SOCKS_YARN_URL,
} from "./worstedColorBlockSocks";

const pageSource = readFileSync(
  resolve("src/pages/knit-ables/worsted-color-block-socks.astro"),
  "utf8",
);
const yarnCardSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleYarnCard.astro"),
  "utf8",
);
const linkedImageSource = readFileSync(
  resolve("src/components/knit-ables/KnitAbleLinkedImage.astro"),
  "utf8",
);
const teenageKicksPage = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const homeSource = readFileSync(resolve("src/pages/index.astro"), "utf8");
const patternsCatalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");

describe("Worsted Color-Block Socks Knit-able page", () => {
  it("is a public prerendered page at the Knit-able route", () => {
    expect(WORSTED_COLOR_BLOCK_SOCKS_PATH).toBe("/knit-ables/worsted-color-block-socks");
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_CANONICAL_URL");
    expect(WORSTED_COLOR_BLOCK_SOCKS_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/worsted-color-block-socks",
    );
    expect(WORSTED_COLOR_BLOCK_SOCKS_TITLE).toBe("Worsted Color-Block Socks");
    expect(pageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_TITLE");
    expect(pageSource).toContain("KnitAblePageHeader");
    expect(pageSource).not.toContain("SleevelessPatternMemberGate");
    expect(pageSource).not.toContain("data-ms-content");
  });

  it("uses the supplied hero image and descriptive alt text", () => {
    expect(WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.src).toBe(
      "/images/knit-ables/worsted-socks/worsted-socks.jpg",
    );
    expect(WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.alt).toBe(
      "Red worsted-weight socks with navy cuffs and heels, cream toes, and narrow cream stripes.",
    );
    expect(WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.fileName).toBe("worsted-socks.jpg");
    expect(existsSync(resolve(`public${WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.src}`))).toBe(
      true,
    );
    expect(pageSource).toContain("heroImage.src");
    expect(pageSource).toContain("heroImage.alt");
    expect(pageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_HERO_COPY");
    expect(WORSTED_COLOR_BLOCK_SOCKS_HERO_COPY).toBe(
      "A simple sock becomes something special with a contrasting cuff, stripe, heel, and toe.",
    );
    expect(linkedImageSource).toContain("object-fit: contain");
  });

  it("opens the original pattern and yarn affiliate destinations in a new tab", () => {
    expect(WORSTED_COLOR_BLOCK_SOCKS_ORIGINAL_PATTERN_URL).toContain("awin1.com/cread.php");
    expect(WORSTED_COLOR_BLOCK_SOCKS_ORIGINAL_PATTERN_URL).toContain(
      "worsted-socks-knitting-pattern",
    );
    expect(WORSTED_COLOR_BLOCK_SOCKS_YARN_URL).toContain("awin1.com/cread.php");
    expect(WORSTED_COLOR_BLOCK_SOCKS_YARN_URL).toContain("wool-of-the-andes-tweed-worsted-yarn");
    expect(WORSTED_COLOR_BLOCK_SOCKS_YARN.href).toBe(WORSTED_COLOR_BLOCK_SOCKS_YARN_URL);
    expect(WORSTED_COLOR_BLOCK_SOCKS_YARN.buttonLabel).toBe("Explore Wool of the Andes Tweed");
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(pageSource).not.toContain("KNIT_ABLE_EXTERNAL_REL");
    expect(yarnCardSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(yarnCardSource).toContain('target="_blank"');
    expect(linkedImageSource).toContain('target="_blank"');
    expect(pageSource).toContain(
      "These are affiliate links. If you make a purchase, Knit It Now may receive a commission at",
    );
  });

  it("does not imply Knit It Now provides the paid Knit Picks pattern", () => {
    expect(pageSource).toContain("Kerin Dimeler-Laurence");
    expect(pageSource).toContain("paid hand-knitting pattern");
    expect(pageSource).toContain("worked from the toe up");
    expect(pageSource).toContain(
      "You do not need to purchase the hand-knitting pattern to use the Sock",
    );
    expect(pageSource).toContain("creates a separate custom machine-knitting pattern");
    expect(pageSource).not.toContain("download the Knit Picks pattern");
    expect(pageSource).not.toContain("includes the Knit Picks pattern");
  });

  it("links both pattern CTAs to a new Sock Builder session", () => {
    expect(knitAbleSockBuilderHref()).toBe("/patterns/socks/builder?new=1");
    expect(knitAbleSockBuilderHref()).toBe(buildSockBuilderNewPatternHref());
    expect(pageSource).toContain("knitAbleSockBuilderHref()");
    expect(pageSource.match(/Build My Custom Sock Pattern/g)?.length).toBe(2);
    expect(pageSource.match(/href=\{sockBuilderHref\}/g)?.length).toBe(2);
    expect(pageSource).toContain("Ready to Knit Your Own?");
  });

  it("uses the established color-placement and build checklists", () => {
    expect(WORSTED_COLOR_BLOCK_SOCKS_COLOR_IDEAS).toHaveLength(6);
    expect(WORSTED_COLOR_BLOCK_SOCKS_BUILD_STEPS).toHaveLength(7);
    expect(pageSource).toContain('id="knit-able-own-heading"');
    expect(pageSource).toContain("Make It Your Own");
    expect(pageSource).toContain("Build Your Version");
    expect(pageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_COLOR_IDEAS");
    expect(pageSource).toContain("WORSTED_COLOR_BLOCK_SOCKS_BUILD_STEPS");
    expect(pageSource).toContain("knit-able-checklist");
  });

  it("does not add a homepage, catalog, or second Socks landing Knit-able card", () => {
    expect(homeSource).not.toContain("worsted-color-block-socks");
    expect(patternsCatalog).not.toContain("worsted-color-block-socks");
    expect(SOCKS_PATTERN_BUILDER_LANDING.knitAble?.href).toBe(TEENAGE_KICKS_SOCKS_PATH);
    expect(SOCKS_PATTERN_BUILDER_LANDING.knitAble?.href).not.toBe(
      WORSTED_COLOR_BLOCK_SOCKS_PATH,
    );
    expect(Array.isArray(SOCKS_PATTERN_BUILDER_LANDING.knitAble)).toBe(false);
  });

  it("does not modify the Teenage Kicks Knit-able page", () => {
    expect(teenageKicksPage).toContain("teenageKicksSockBuilderHref()");
    expect(teenageKicksPage).toContain("Colorful Self-Striping Socks");
    expect(teenageKicksPage).not.toContain("worsted-color-block-socks");
    expect(teenageKicksPage).not.toContain("Worsted Color-Block Socks");
  });

  it("keeps the Knit-ables index card copy ready for discovery", () => {
    expect(WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY).toBe(
      "Turn a basic sock into a cozy color-blocked design with a contrasting cuff, stripe, heel, and toe.",
    );
  });
});
