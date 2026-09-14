import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSockBuilderNewPatternHref } from "../patterns/sock/sockFreshStart";
import { KNIT_ABLE_AFFILIATE_REL, KNIT_ABLE_EXTERNAL_REL } from "./links";
import {
  TEENAGE_KICKS_CUSTOM_SUGGESTIONS,
  TEENAGE_KICKS_IMAGES,
  TEENAGE_KICKS_ORIGINAL_PATTERN_URL,
  TEENAGE_KICKS_SOCKS_CANONICAL_URL,
  TEENAGE_KICKS_SOCKS_PATH,
  TEENAGE_KICKS_STATIC_YARN_URL,
  TEENAGE_KICKS_STROLL_YARN_URL,
  TEENAGE_KICKS_YARN_RECOMMENDATIONS,
  teenageKicksSockBuilderHref,
} from "./teenageKicksSocks";

const pageSource = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
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
const homeSource = readFileSync(resolve("src/pages/index.astro"), "utf8");
const patternsCatalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const socksBuilder = readFileSync(resolve("src/pages/patterns/socks/builder.astro"), "utf8");

describe("Teenage Kicks Socks Knit-able page", () => {
  it("is a public prerendered page at the Knit-able route", () => {
    expect(TEENAGE_KICKS_SOCKS_PATH).toBe("/knit-ables/teenage-kicks-socks");
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain("TEENAGE_KICKS_SOCKS_CANONICAL_URL");
    expect(TEENAGE_KICKS_SOCKS_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/teenage-kicks-socks",
    );
    expect(pageSource).not.toContain("SleevelessPatternMemberGate");
    expect(pageSource).not.toContain("data-ms-content");
  });

  it("links both pattern CTAs to the existing Basic Socks Pattern Builder", () => {
    expect(teenageKicksSockBuilderHref()).toBe("/patterns/socks/builder?new=1");
    expect(teenageKicksSockBuilderHref()).toBe(buildSockBuilderNewPatternHref());
    expect(pageSource).toContain("teenageKicksSockBuilderHref()");
    expect(pageSource.match(/Build My Custom Sock Pattern/g)?.length).toBe(2);
    expect(pageSource.match(/href=\{sockBuilderHref\}/g)?.length).toBe(2);
    expect(socksBuilder).toContain("Basic Socks Builder");
  });

  it("uses the supplied image filenames without renaming them", () => {
    expect(TEENAGE_KICKS_IMAGES.hero.fileName).toBe("56188220_2.jpg");
    expect(TEENAGE_KICKS_IMAGES.stripeProgression.fileName).toBe("56188220_3.jpg");
    expect(TEENAGE_KICKS_IMAGES.staticYarn.fileName).toBe("static.jpg");
    expect(TEENAGE_KICKS_IMAGES.strollYarn.fileName).toBe("stroll.jpg");

    for (const image of Object.values(TEENAGE_KICKS_IMAGES)) {
      expect(existsSync(resolve(`public${image.src}`))).toBe(true);
    }

    expect(pageSource).toContain("heroImage.src");
    expect(pageSource).toContain("stripeImage.src");
    expect(pageSource).toContain("yarn.image.src");
    expect(linkedImageSource).toContain("width={width}");
    expect(linkedImageSource).toContain("height={height}");
    expect(linkedImageSource).toContain("object-fit: contain");
  });

  it("opens the original pattern and affiliate yarn destinations in a new tab", () => {
    expect(TEENAGE_KICKS_ORIGINAL_PATTERN_URL).toBe(
      "https://www.knitpicks.com/teenage-kicks-socks-free-knitting-pattern/p/56188",
    );
    expect(TEENAGE_KICKS_STATIC_YARN_URL).toContain("awin1.com/cread.php");
    expect(TEENAGE_KICKS_STATIC_YARN_URL).toContain("static-yarn");
    expect(TEENAGE_KICKS_STROLL_YARN_URL).toContain("stroll-yarn");
    expect(KNIT_ABLE_EXTERNAL_REL).toBe("noopener noreferrer");
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("KNIT_ABLE_EXTERNAL_REL");
    expect(yarnCardSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(yarnCardSource).toContain('target="_blank"');
    expect(linkedImageSource).toContain('target="_blank"');
    expect(TEENAGE_KICKS_YARN_RECOMMENDATIONS).toHaveLength(2);
    expect(TEENAGE_KICKS_YARN_RECOMMENDATIONS[0]?.featured).toBe(true);
    expect(TEENAGE_KICKS_CUSTOM_SUGGESTIONS).toHaveLength(5);
  });

  it("offers both Cuff to Toe and Toe Up construction", () => {
    expect(TEENAGE_KICKS_CUSTOM_SUGGESTIONS[0]).toBe(
      "Choose Cuff to Toe or Toe Up construction",
    );
    expect(TEENAGE_KICKS_CUSTOM_SUGGESTIONS[0]).toContain("Cuff to Toe");
    expect(TEENAGE_KICKS_CUSTOM_SUGGESTIONS[0]).toContain("Toe Up");
    expect(pageSource).toContain(
      "The original inspiration is knitted from the top down, but your Knit It Now pattern can",
    );
    expect(pageSource).toContain(
      "be created either Cuff to Toe or Toe Up. Choose the construction you prefer.",
    );
  });

  it("does not add a homepage card or catalog card in this pass", () => {
    expect(homeSource).not.toContain("knit-ables");
    expect(patternsCatalog).not.toContain("knit-ables");
    expect(socksBuilder).not.toContain("knit-ables");
  });
});
