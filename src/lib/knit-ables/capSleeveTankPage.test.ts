import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDropShoulderBuilderNewPatternHref } from "../patterns/patternStorage";
import { DROP_SHOULDER_PATTERN_BUILDER_LANDING } from "../patterns/dropShoulderPatternLanding";
import { KNIT_ABLE_AFFILIATE_REL, KNIT_ABLE_EXTERNAL_REL } from "./links";
import {
  CAP_SLEEVE_TANK_BUILD_STEPS,
  CAP_SLEEVE_TANK_BUILDER_LINK_LABEL,
  CAP_SLEEVE_TANK_CANONICAL_URL,
  CAP_SLEEVE_TANK_CARD_COPY,
  CAP_SLEEVE_TANK_COLLAR_IDEA,
  CAP_SLEEVE_TANK_COLLAR_VIDEO,
  CAP_SLEEVE_TANK_DESIGN_COPY_AFTER,
  CAP_SLEEVE_TANK_DESIGN_COPY_BEFORE,
  CAP_SLEEVE_TANK_DESIGN_HEADING,
  CAP_SLEEVE_TANK_HERO_COPY,
  CAP_SLEEVE_TANK_IMAGES,
  CAP_SLEEVE_TANK_ORIGINAL_PATTERN_URL,
  CAP_SLEEVE_TANK_OWN_IDEAS,
  CAP_SLEEVE_TANK_PATH,
  CAP_SLEEVE_TANK_TITLE,
  CAP_SLEEVE_TANK_YARN,
  CAP_SLEEVE_TANK_YARN_URL,
  capSleeveTankBuilderHref,
} from "./capSleeveTank";

const pageSource = readFileSync(resolve("src/pages/knit-ables/cap-sleeve-tank.astro"), "utf8");
const homeSource = readFileSync(resolve("src/pages/index.astro"), "utf8");
const patternsCatalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const teenageKicksPage = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const worstedPage = readFileSync(
  resolve("src/pages/knit-ables/worsted-color-block-socks.astro"),
  "utf8",
);

describe("Cap-sleeve tank Knit-able page", () => {
  it("is a server-rendered page at the Knit-able route", () => {
    expect(CAP_SLEEVE_TANK_PATH).toBe("/knit-ables/cap-sleeve-tank");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: CAP_SLEEVE_TANK_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_CANONICAL_URL");
    expect(CAP_SLEEVE_TANK_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/cap-sleeve-tank",
    );
    expect(CAP_SLEEVE_TANK_TITLE).toBe(
      "Turn a Drop Shoulder Sweater into a Cap-Sleeve Tank",
    );
    expect(pageSource).toContain("CAP_SLEEVE_TANK_TITLE");
    expect(pageSource).toContain("KnitAblePageHeader");
    expect(pageSource).not.toContain("SleevelessPatternMemberGate");
    expect(pageSource).not.toContain("data-ms-content");
  });

  it("uses the local comparison image", () => {
    expect(CAP_SLEEVE_TANK_IMAGES.hero.src).toBe(
      "/images/knit-ables/branch-out-tank/branch-out-tank.webp",
    );
    expect(CAP_SLEEVE_TANK_IMAGES.hero.fileName).toBe("branch-out-tank.webp");
    expect(CAP_SLEEVE_TANK_IMAGES.hero.width).toBe(601);
    expect(CAP_SLEEVE_TANK_IMAGES.hero.height).toBe(310);
    expect(existsSync(resolve(`public${CAP_SLEEVE_TANK_IMAGES.hero.src}`))).toBe(true);
    expect(pageSource).toContain("heroImage.src");
    expect(pageSource).toContain("heroImage.alt");
    expect(pageSource).not.toContain("grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr)");
    expect(CAP_SLEEVE_TANK_HERO_COPY).toContain("Sirdar’s Branch Out Tank");
    expect(CAP_SLEEVE_TANK_DESIGN_COPY_AFTER).toContain("leave off the sleeves");
    expect(CAP_SLEEVE_TANK_DESIGN_COPY_AFTER).toContain("choose a collar and finish the armholes");
  });

  it("opens the Sirdar pattern and yarn pages through Awin affiliate links", () => {
    expect(CAP_SLEEVE_TANK_ORIGINAL_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2F10969-branch-out-tank-knitting-pattern-in-sirdar-loveful-bio-blend-chunky",
    );
    expect(CAP_SLEEVE_TANK_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2Fsirdar-loveful-bio-blend-dk-100g",
    );
    expect(CAP_SLEEVE_TANK_ORIGINAL_PATTERN_URL).toContain("&awinaffid=2040643&");
    expect(CAP_SLEEVE_TANK_YARN_URL).toContain("&awinaffid=2040643&");
    expect(CAP_SLEEVE_TANK_YARN.href).toBe(CAP_SLEEVE_TANK_YARN_URL);
    expect(CAP_SLEEVE_TANK_YARN.heading).toBe("Sirdar Loveful Bio Blend DK");
    expect(CAP_SLEEVE_TANK_YARN.buttonLabel).toBe("Explore Sirdar Loveful Bio Blend DK");
    expect(KNIT_ABLE_EXTERNAL_REL).toBe("noopener noreferrer");
    expect(KNIT_ABLE_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
    expect(pageSource).toContain("KNIT_ABLE_AFFILIATE_REL");
    expect(pageSource).not.toContain("KNIT_ABLE_EXTERNAL_REL");
    expect(pageSource).not.toContain("https://sirdar.com/en/products/");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("rel={KNIT_ABLE_AFFILIATE_REL}");
    expect(pageSource).toContain("href={CAP_SLEEVE_TANK_ORIGINAL_PATTERN_URL}");
    expect(pageSource).toContain("href={CAP_SLEEVE_TANK_YARN.href}");
  });

  it("introduces the tank as inspiration and links the builder in the design copy", () => {
    expect(CAP_SLEEVE_TANK_DESIGN_HEADING).toBe("Design It Your Way");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_DESIGN_HEADING");
    expect(CAP_SLEEVE_TANK_HERO_COPY).toBe(
      "Love the look of Sirdar’s Branch Out Tank? Use it as inspiration to make your own version on the knitting machine.",
    );
    expect(CAP_SLEEVE_TANK_BUILDER_LINK_LABEL).toBe("Drop Shoulder Sweater builder");
    expect(CAP_SLEEVE_TANK_DESIGN_COPY_BEFORE).toBe("Start with a custom fit from our ");
    expect(CAP_SLEEVE_TANK_DESIGN_COPY_AFTER).toContain("add embroidery");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_BUILDER_LINK_LABEL");
    expect(pageSource).toContain('href={builderHref}>{CAP_SLEEVE_TANK_BUILDER_LINK_LABEL}');
    expect(pageSource).not.toContain("does not show how to reproduce");
    expect(pageSource).not.toContain("This is an adaptation idea");
    expect(pageSource).not.toContain("CAP_SLEEVE_TANK_ADAPTATION_NOTE");
    expect(pageSource).toContain("You do not need to purchase the Sirdar pattern");
    expect(pageSource).toContain("creates a separate custom machine-knitting pattern");
    expect(pageSource).toContain("written for Loveful Bio Blend");
    expect(pageSource).toContain("Chunky");
    expect(CAP_SLEEVE_TANK_YARN.paragraphs.join(" ")).toContain("chunky yarn");
    expect(pageSource).not.toContain("climbing vine");
    expect(pageSource).not.toContain("embroidery instructions");
  });

  it("shows the Loveful Bio Blend photo beside the yarn description", () => {
    expect(CAP_SLEEVE_TANK_IMAGES.yarn.src).toBe(
      "/images/knit-ables/branch-out-tank/sirdar_loveful_bio-blend.jpg",
    );
    expect(CAP_SLEEVE_TANK_IMAGES.yarn.fileName).toBe("sirdar_loveful_bio-blend.jpg");
    expect(CAP_SLEEVE_TANK_IMAGES.yarn.width).toBe(778);
    expect(CAP_SLEEVE_TANK_IMAGES.yarn.height).toBe(959);
    expect(existsSync(resolve(`public${CAP_SLEEVE_TANK_IMAGES.yarn.src}`))).toBe(true);
    expect(pageSource).toContain("yarnImage.src");
    expect(pageSource).toContain('imagePlacement="beside"');
  });

  it("links both pattern CTAs to a new Drop Shoulder Sweater pattern", () => {
    expect(capSleeveTankBuilderHref()).toBe("/patterns/drop-shoulder/builder?new=1");
    expect(capSleeveTankBuilderHref()).toBe(buildDropShoulderBuilderNewPatternHref());
    expect(pageSource).toContain("capSleeveTankBuilderHref()");
    expect(pageSource.match(/Open the Drop Shoulder Sweater Builder/g)?.length).toBe(2);
    expect(pageSource.match(/href=\{builderHref\}/g)?.length).toBe(3);
    expect(pageSource).toContain("Ready to Knit Your Own?");
  });

  it("uses the established make-it-your-own and build checklists", () => {
    expect(CAP_SLEEVE_TANK_OWN_IDEAS).toHaveLength(5);
    expect(CAP_SLEEVE_TANK_OWN_IDEAS[0]).toBe("Embrace Sirdar’s embroidery or get creative.");
    expect(CAP_SLEEVE_TANK_OWN_IDEAS.join(" ")).not.toContain("round neck or V-neck");
    expect(CAP_SLEEVE_TANK_OWN_IDEAS.join(" ")).not.toContain("Set those aside and knit the body");
    expect(CAP_SLEEVE_TANK_BUILD_STEPS).toHaveLength(6);
    expect(pageSource).toContain('id="knit-able-own-heading"');
    expect(pageSource).toContain("Make It Your Own");
    expect(pageSource).toContain("Build Your Version");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_OWN_IDEAS");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_BUILD_STEPS");
    expect(pageSource).toContain("knit-able-checklist");
    expect(CAP_SLEEVE_TANK_OWN_IDEAS[1]).toBe("Plan a finished edge for each armhole.");
    expect(CAP_SLEEVE_TANK_OWN_IDEAS).toContain(CAP_SLEEVE_TANK_COLLAR_IDEA);
  });

  it("offers the collar video beside the collar suggestion, outside the builder call to action", () => {
    expect(CAP_SLEEVE_TANK_COLLAR_VIDEO.href).toBe("/videos/962");
    expect(CAP_SLEEVE_TANK_COLLAR_VIDEO.title).toBe("Collars for Machine Knitters");
    expect(CAP_SLEEVE_TANK_COLLAR_VIDEO.prompt).toBe("Need help with the collar?");
    expect(CAP_SLEEVE_TANK_COLLAR_VIDEO.accessLabel).toBe("Members");
    expect(pageSource).toContain("CAP_SLEEVE_TANK_COLLAR_VIDEO");
    expect(pageSource).toContain("knit-able-member-resource");
    expect(pageSource).toContain("Watch {CAP_SLEEVE_TANK_COLLAR_VIDEO.title}");

    const ownSection = pageSource.slice(
      pageSource.indexOf('id="knit-able-own-heading"'),
      pageSource.indexOf('id="knit-able-build-heading"'),
    );
    const ctaSection = pageSource.slice(pageSource.indexOf('class="knit-able-cta"'));
    expect(ownSection).toContain("CAP_SLEEVE_TANK_COLLAR_IDEA");
    expect(ownSection).toContain("CAP_SLEEVE_TANK_COLLAR_VIDEO.href");
    expect(ctaSection).not.toContain("CAP_SLEEVE_TANK_COLLAR_VIDEO");
    expect(ctaSection).not.toContain("/videos/962");
    expect(pageSource).not.toContain('href={CAP_SLEEVE_TANK_COLLAR_VIDEO.href} class="kbm-btn');
  });

  it("does not add a homepage, catalog, or Drop Shoulder landing Knit-able card", () => {
    expect(homeSource).not.toContain("cap-sleeve-tank");
    expect(patternsCatalog).not.toContain("cap-sleeve-tank");
    expect(DROP_SHOULDER_PATTERN_BUILDER_LANDING.knitAble).toBeUndefined();
  });

  it("does not modify the earlier Knit-able pages", () => {
    expect(teenageKicksPage).not.toContain("cap-sleeve-tank");
    expect(teenageKicksPage).not.toContain("Branch Out Tank");
    expect(worstedPage).not.toContain("cap-sleeve-tank");
    expect(worstedPage).not.toContain("Branch Out Tank");
  });

  it("keeps the Knit-ables index card copy ready for discovery", () => {
    expect(CAP_SLEEVE_TANK_CARD_COPY).toBe(
      "Use the Drop Shoulder Sweater builder, omit the sleeves, and plan a collar and finished armholes for a cap-sleeve tank.",
    );
  });
});
