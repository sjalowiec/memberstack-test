import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../patterns/christmasStockingPatternLanding";
import { buildSockBuilderNewPatternHref } from "../patterns/christmasStocking/sockFreshStart";
import { CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE } from "./christmasStockingsYourWay";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";
import { KNIT_ABLES_CARDS } from "./knitAblesLanding";
import { KNIT_ABLE_INITIAL_PUBLISH_DATES } from "./schedule";
import {
  formatNiftyGiftyTreeSize,
  getNiftyGiftyStockingTrees,
  niftyGiftyStockingBuilderHref,
  NIFTY_GIFTY_STOCKING_AFFILIATE_DISCLOSURE,
  NIFTY_GIFTY_STOCKING_AFFILIATE_REL,
  NIFTY_GIFTY_STOCKING_BUILDER_CTA,
  NIFTY_GIFTY_STOCKING_BUILDER_LINK_LABEL,
  NIFTY_GIFTY_STOCKING_CANONICAL_URL,
  NIFTY_GIFTY_STOCKING_CARD_COPY,
  NIFTY_GIFTY_STOCKING_DESCRIPTION,
  NIFTY_GIFTY_STOCKING_GRAPH_PAPER_HREF,
  NIFTY_GIFTY_STOCKING_GRAPH_PAPER_LABEL,
  NIFTY_GIFTY_STOCKING_IMAGES,
  NIFTY_GIFTY_STOCKING_MOTIF_HEADING,
  NIFTY_GIFTY_STOCKING_MOTIF_INTRO,
  NIFTY_GIFTY_STOCKING_PATH,
  NIFTY_GIFTY_STOCKING_PATTERN_LINK_LABEL,
  NIFTY_GIFTY_STOCKING_PATTERN_NOTE,
  NIFTY_GIFTY_STOCKING_PATTERN_URL,
  NIFTY_GIFTY_STOCKING_RIB_HEADING,
  NIFTY_GIFTY_STOCKING_RIB_VIDEO,
  NIFTY_GIFTY_STOCKING_TITLE,
  NIFTY_GIFTY_STOCKING_TREE_INTRO,
  NIFTY_GIFTY_STOCKING_TREE_SPECS,
  NIFTY_GIFTY_STOCKING_YARN,
  NIFTY_GIFTY_STOCKING_YARN_URL,
} from "./niftyGiftyStocking";

const pageSource = readFileSync(
  resolve("src/pages/knit-ables/nifty-gifty-stocking.astro"),
  "utf8",
);

function pngSize(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("Nifty Gifty Stocking Knit-able", () => {
  it("stays unpublished until Watson saves a date", () => {
    expect(NIFTY_GIFTY_STOCKING_PATH).toBe("/knit-ables/nifty-gifty-stocking");
    expect(NIFTY_GIFTY_STOCKING_CANONICAL_URL).toBe(
      "https://knititnow.com/knit-ables/nifty-gifty-stocking",
    );
    expect(NIFTY_GIFTY_STOCKING_TITLE).toBe("Nifty Gifty Stocking");
    expect(NIFTY_GIFTY_STOCKING_DESCRIPTION).toContain("mini stocking");
    expect(pageSource).toContain("export const prerender = false");
    expect(pageSource).toContain("loadKnitAblePageAccess");
    expect(pageSource).toContain("path: NIFTY_GIFTY_STOCKING_PATH");
    expect(pageSource).toContain("knitAbleAccess.visible");
    expect(pageSource).toContain("applyKnitAbleCacheHeaders");
    expect(pageSource).toContain("`${NIFTY_GIFTY_STOCKING_TITLE} | Knit it Now`");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["nifty-gifty-stocking"]).toBeUndefined();
    expect(KNIT_ABLES_CARDS[1]?.href).toBe(NIFTY_GIFTY_STOCKING_PATH);
    expect(KNIT_ABLES_CARDS[1]?.title).toBe(NIFTY_GIFTY_STOCKING_TITLE);
    expect(KNIT_ABLES_CARDS[1]?.description).toBe(NIFTY_GIFTY_STOCKING_CARD_COPY);
    expect(pageSource).not.toContain("nifty-grifty");
    expect(NIFTY_GIFTY_STOCKING_TITLE).not.toContain("Grifty");
  });

  it("uses the existing project photo, including its filename spelling", () => {
    const imagePath = resolve(`public${NIFTY_GIFTY_STOCKING_IMAGES.hero.src}`);
    expect(NIFTY_GIFTY_STOCKING_IMAGES.hero.fileName).toBe("nifty-grifty-stocking.png");
    expect(NIFTY_GIFTY_STOCKING_IMAGES.hero.src).toBe(
      "/images/knit-ables/christmas-stockings/nifty-grifty-stocking.png",
    );
    expect(existsSync(imagePath)).toBe(true);
    expect(pngSize(imagePath)).toEqual({
      width: NIFTY_GIFTY_STOCKING_IMAGES.hero.width,
      height: NIFTY_GIFTY_STOCKING_IMAGES.hero.height,
    });
    expect(pageSource).toContain("alt={heroImage.alt}");
    expect(pageSource).toContain('loading="eager"');
  });

  it("places the pattern and yarn beside the photo, then ribbing and motif planning", () => {
    const markup = pageSource.slice(pageSource.indexOf("<article>"));
    const intro = markup.indexOf("knit-able-hero__intro");
    const photo = markup.indexOf("knit-able-hero__figure");
    const offers = markup.indexOf("knit-able-hero__offers");
    const disclosure = markup.indexOf("NIFTY_GIFTY_STOCKING_AFFILIATE_DISCLOSURE");
    const patternNote = markup.indexOf("NIFTY_GIFTY_STOCKING_PATTERN_NOTE");
    const patternLink = markup.indexOf("NIFTY_GIFTY_STOCKING_PATTERN_URL");
    const yarn = markup.indexOf("knit-able-yarn-heading");
    const rib = markup.indexOf("data-nifty-gifty-rib");
    const builder = markup.indexOf("data-nifty-gifty-builder");
    const motif = markup.indexOf("knit-able-motif-heading");
    const graphPaper = markup.indexOf("NIFTY_GIFTY_STOCKING_GRAPH_PAPER_HREF");
    const gallery = markup.indexOf("knit-able-trees");
    expect(intro).toBeGreaterThan(-1);
    expect(photo).toBeGreaterThan(intro);
    expect(offers).toBeGreaterThan(photo);
    expect(disclosure).toBeGreaterThan(offers);
    expect(patternNote).toBeGreaterThan(disclosure);
    expect(patternLink).toBeGreaterThan(patternNote);
    expect(yarn).toBeGreaterThan(patternLink);
    expect(offers).toBeLessThan(rib);
    expect(rib).toBeGreaterThan(yarn);
    expect(builder).toBeGreaterThan(rib);
    expect(motif).toBeGreaterThan(builder);
    expect(graphPaper).toBeGreaterThan(motif);
    expect(gallery).toBeGreaterThan(graphPaper);
    expect(markup.slice(motif, gallery)).toContain("NIFTY_GIFTY_STOCKING_MOTIF_INTRO");
    expect(pageSource).toContain('"photo intro"');
    expect(pageSource).toContain('"photo offers"');
    expect(pageSource).toContain("height: auto");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain("rel={NIFTY_GIFTY_STOCKING_AFFILIATE_REL}");
    expect(pageSource).not.toContain("stocking body instructions");
  });

  it("keeps both Awin URLs and the existing affiliate disclosure", () => {
    expect(NIFTY_GIFTY_STOCKING_PATTERN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fnifty-gifty-stocking-knitting-pattern%2Fp%2F18927D",
    );
    expect(NIFTY_GIFTY_STOCKING_YARN_URL).toBe(
      "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fwool-of-the-andes-sport-yarn%2Fc%2F5420110",
    );
    expect(NIFTY_GIFTY_STOCKING_YARN.href).toBe(NIFTY_GIFTY_STOCKING_YARN_URL);
    expect(NIFTY_GIFTY_STOCKING_PATTERN_LINK_LABEL).toBe(
      "Get the Nifty Gifty Stocking pattern from Knit Picks",
    );
    expect(NIFTY_GIFTY_STOCKING_PATTERN_NOTE).toContain("tree shown in the photo");
    expect(NIFTY_GIFTY_STOCKING_AFFILIATE_DISCLOSURE).toBe(
      CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
    );
    expect(NIFTY_GIFTY_STOCKING_AFFILIATE_REL).toBe(KNIT_ABLE_AFFILIATE_REL);
    expect(NIFTY_GIFTY_STOCKING_AFFILIATE_REL).toBe("sponsored noopener noreferrer");
  });

  it("points the cuff to the Corrugated Rib video and the instructions to the stocking builder", () => {
    expect(NIFTY_GIFTY_STOCKING_RIB_HEADING).toBe("Ribbed cuff");
    expect(NIFTY_GIFTY_STOCKING_RIB_VIDEO).toEqual({
      href: "/videos/698",
      title: "Corrugated Rib on the Machine",
      prompt: "For the ribbed cuff, watch",
      accessLabel: "Members",
    });
    expect(pageSource).toContain("NIFTY_GIFTY_STOCKING_RIB_VIDEO.href");
    expect(pageSource).toContain("knit-able-member-resource__label");
    expect(pageSource).not.toContain("Placeholder for review");
    expect(pageSource).not.toContain("ribbing instructions");

    expect(existsSync(resolve("src/pages/patterns/christmas-stocking/builder.astro"))).toBe(true);
    expect(NIFTY_GIFTY_STOCKING_BUILDER_LINK_LABEL).toBe("Christmas Stocking builder");
    expect(niftyGiftyStockingBuilderHref()).toBe("/patterns/christmas-stocking/builder?new=1");
    expect(niftyGiftyStockingBuilderHref()).toBe(buildSockBuilderNewPatternHref());
    expect(niftyGiftyStockingBuilderHref()).not.toBe("/patterns/socks/builder?new=1");
    expect(NIFTY_GIFTY_STOCKING_BUILDER_CTA).toBe(CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta);
    expect(NIFTY_GIFTY_STOCKING_BUILDER_CTA.memberHref).toBe(niftyGiftyStockingBuilderHref());
    expect(pageSource).toContain("niftyGiftyStockingBuilderHref()");
    expect(pageSource).toContain("data-pattern-builder-landing");
    expect(pageSource).toContain("initPatternBuilderLandingCta");
    expect(pageSource).not.toContain("/patterns/socks/builder");
  });

  it("links the graph paper tool and all 13 Stitch Library trees", () => {
    expect(NIFTY_GIFTY_STOCKING_MOTIF_HEADING).toBe("Make It Your Own");
    expect(NIFTY_GIFTY_STOCKING_MOTIF_INTRO).toContain("Before you knit the stocking body");
    expect(NIFTY_GIFTY_STOCKING_GRAPH_PAPER_HREF).toBe("/tools/graph-paper");
    expect(NIFTY_GIFTY_STOCKING_GRAPH_PAPER_LABEL).toBe(
      "Open the free knitting graph paper tool",
    );
    expect(NIFTY_GIFTY_STOCKING_TREE_INTRO).toBe(
      "Choose a Christmas tree for your stocking. Click a design to visit its Stitch Library page. Members can download the DesignaKnit file and a full-size punch card template.",
    );
    expect(pageSource).toContain("object-fit: contain");
    expect(pageSource).toContain("repeat(2, minmax(0, 1fr))");
    expect(pageSource).toContain("minmax(150px, 1fr)");
    expect(pageSource).toContain('alt=""');

    const trees = getNiftyGiftyStockingTrees();
    expect(trees).toHaveLength(13);
    expect(NIFTY_GIFTY_STOCKING_TREE_SPECS).toHaveLength(13);
    expect(trees.map((tree) => [tree.id, tree.label, tree.swatchSrc, tree.href])).toEqual([
      [1187, "Tree 1", "/stitch-patterns/swatches/15/tree1.jpg", "/stitch/1187"],
      [1188, "Tree 2", "/stitch-patterns/swatches/15/tree2.jpg", "/stitch/1188"],
      [1189, "Tree 3", "/stitch-patterns/swatches/15/tree3.jpg", "/stitch/1189"],
      [1190, "Tree 4", "/stitch-patterns/swatches/15/tree4.jpg", "/stitch/1190"],
      [1191, "Tree 5", "/stitch-patterns/swatches/15/tree5.jpg", "/stitch/1191"],
      [1192, "Tree 6", "/stitch-patterns/swatches/15/tree6.jpg", "/stitch/1192"],
      [1193, "Tree 7", "/stitch-patterns/swatches/15/tree7.jpg", "/stitch/1193"],
      [1194, "Tree 8", "/stitch-patterns/swatches/15/tree8.jpg", "/stitch/1194"],
      [1195, "Tree 9", "/stitch-patterns/swatches/15/tree9.jpg", "/stitch/1195"],
      [1186, "Tree 10", "/stitch-patterns/swatches/15/tree10.jpg", "/stitch/1186"],
      [1196, "Tree 11", "/stitch-patterns/swatches/15/tree11.jpg", "/stitch/1196"],
      [1197, "Tree 12", "/stitch-patterns/swatches/15/tree12.jpg", "/stitch/1197"],
      [1262, "Tree 13", "/stitch-patterns/swatches/15/tree13.jpg", "/stitch/1262"],
    ]);
    expect(formatNiftyGiftyTreeSize("11x14")).toBe("11 stitches × 14 rows");
    expect(formatNiftyGiftyTreeSize("17 x 29")).toBe("17 stitches × 29 rows");
    expect(trees[0]?.sizeLabel).toBe("11 stitches × 14 rows");
    expect(trees[9]?.sizeLabel).toBe("17 stitches × 29 rows");
    for (const tree of trees) {
      expect(existsSync(resolve(`public${tree.swatchSrc}`))).toBe(true);
    }
  });
});
