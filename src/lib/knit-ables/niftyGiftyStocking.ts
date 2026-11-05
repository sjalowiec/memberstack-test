/**
 * Nifty Gifty Stocking Knit-able.
 * The project photo filename is nifty-grifty-stocking.png. Visible copy uses Nifty Gifty Stocking.
 * Ribbing copy lives in NIFTY_GIFTY_STOCKING_RIB_INSTRUCTIONS until the cuff steps are added.
 */
import { getStitchCatalogItems } from "../stitch-data";
import { KNIT_ABLE_AFFILIATE_REL } from "./links";

export const NIFTY_GIFTY_STOCKING_PATH = "/knit-ables/nifty-gifty-stocking";

export const NIFTY_GIFTY_STOCKING_CANONICAL_URL =
  "https://knititnow.com/knit-ables/nifty-gifty-stocking";

export const NIFTY_GIFTY_STOCKING_TITLE = "Nifty Gifty Stocking";

export const NIFTY_GIFTY_STOCKING_EYEBROW = "Hand to Machine Inspiration";

export const NIFTY_GIFTY_STOCKING_TAGLINE =
  "A mini stocking you can personalize with a small motif.";

export const NIFTY_GIFTY_STOCKING_INTRO =
  "Knit this little Christmas stocking, then add a Christmas tree, an initial, or a design of your own.";

export const NIFTY_GIFTY_STOCKING_DESCRIPTION = `${NIFTY_GIFTY_STOCKING_TAGLINE} ${NIFTY_GIFTY_STOCKING_INTRO}`;

/** Knit Picks Nifty Gifty Stocking pattern. Awin affiliate link. */
export const NIFTY_GIFTY_STOCKING_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fnifty-gifty-stocking-knitting-pattern%2Fp%2F18927D";

export const NIFTY_GIFTY_STOCKING_PATTERN_LINK_LABEL =
  "Get the Nifty Gifty Stocking pattern from Knit Picks";

export const NIFTY_GIFTY_STOCKING_PATTERN_NOTE =
  "The original Knit Picks pattern includes the tree shown in the photo.";

/** Wool of the Andes Sport shop page. Awin affiliate link. */
export const NIFTY_GIFTY_STOCKING_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fwool-of-the-andes-sport-yarn%2Fc%2F5420110";

export const NIFTY_GIFTY_STOCKING_AFFILIATE_REL = KNIT_ABLE_AFFILIATE_REL;

export const NIFTY_GIFTY_STOCKING_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

const IMAGE_DIR = "/images/knit-ables/christmas-stockings";

export const NIFTY_GIFTY_STOCKING_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/nifty-grifty-stocking.png`,
    alt: "Hands holding a mini cream Christmas stocking with a green ribbed cuff, a green tree with red ornaments and a yellow star, and a red heel and toe.",
    width: 1059,
    height: 1485,
    fileName: "nifty-grifty-stocking.png",
  },
} as const;

export const NIFTY_GIFTY_STOCKING_YARN_HEADING = "Yarn";

export const NIFTY_GIFTY_STOCKING_YARN = {
  heading: "Wool of the Andes Sport",
  paragraphs: [
    "Wool of the Andes Sport is a yarn you can shop for this mini stocking. Swatch it on your machine and use the gauge you get.",
  ],
  buttonLabel: "Shop Wool of the Andes Sport",
  href: NIFTY_GIFTY_STOCKING_YARN_URL,
} as const;

export const NIFTY_GIFTY_STOCKING_RIB_HEADING = "Ribbed cuff";

/**
 * Machine-knitting ribbing for the cuff.
 * Replace these paragraphs with the ribbing instructions. The Ribbed cuff section renders this list.
 */
export const NIFTY_GIFTY_STOCKING_RIB_INSTRUCTIONS = [
  "Placeholder for review: the machine-knitting ribbing instructions for this cuff will go here.",
] as const;

export const NIFTY_GIFTY_STOCKING_MOTIF_HEADING = "Make It Your Own";

export const NIFTY_GIFTY_STOCKING_MOTIF_INTRO =
  "Want to add a little Christmas tree, an initial, or a design of your own? Before you knit the stocking body, count how many stitches across and how many rows high you have in the area you want to decorate. Mark out that space on the graph paper and draw your motif inside it. Each box represents one stitch across and one row high.";

/** Free graph paper tool. Same page as https://knititnow.com/tools/graph-paper. */
export const NIFTY_GIFTY_STOCKING_GRAPH_PAPER_HREF = "/tools/graph-paper";

export const NIFTY_GIFTY_STOCKING_GRAPH_PAPER_LABEL =
  "Open the free knitting graph paper tool";

export const NIFTY_GIFTY_STOCKING_TREE_HEADING = "Christmas Tree Inspiration";

export const NIFTY_GIFTY_STOCKING_TREE_INTRO =
  "These trees are inspiration. Click any swatch to open its Knit It Now Stitch Library entry. If you’d like to use one of these trees, check its stitch and row counts against the space available on your stocking at your gauge.";

const SWATCH_DIR = "/stitch-patterns/swatches/15";

/** Gallery order. Tree 10 is stitch 1186, before the other tree ids. */
export const NIFTY_GIFTY_STOCKING_TREE_SPECS = [
  { id: 1187, label: "Tree 1", filename: "tree1.jpg" },
  { id: 1188, label: "Tree 2", filename: "tree2.jpg" },
  { id: 1189, label: "Tree 3", filename: "tree3.jpg" },
  { id: 1190, label: "Tree 4", filename: "tree4.jpg" },
  { id: 1191, label: "Tree 5", filename: "tree5.jpg" },
  { id: 1192, label: "Tree 6", filename: "tree6.jpg" },
  { id: 1193, label: "Tree 7", filename: "tree7.jpg" },
  { id: 1194, label: "Tree 8", filename: "tree8.jpg" },
  { id: 1195, label: "Tree 9", filename: "tree9.jpg" },
  { id: 1186, label: "Tree 10", filename: "tree10.jpg" },
  { id: 1196, label: "Tree 11", filename: "tree11.jpg" },
  { id: 1197, label: "Tree 12", filename: "tree12.jpg" },
  { id: 1262, label: "Tree 13", filename: "tree13.jpg" },
] as const;

export type NiftyGiftyStockingTree = {
  id: number;
  label: string;
  href: string;
  swatchSrc: string;
  stitchMultiple: string;
  sizeLabel: string;
};

export function formatNiftyGiftyTreeSize(stitchMultiple: string): string {
  const match = stitchMultiple.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) return stitchMultiple.trim();
  return `${match[1]} stitches × ${match[2]} rows`;
}

/** Stitch Library rows for the gallery, in the order shown on the page. */
export function getNiftyGiftyStockingTrees(): NiftyGiftyStockingTree[] {
  const byId = new Map(getStitchCatalogItems().map((item) => [item.id, item]));
  return NIFTY_GIFTY_STOCKING_TREE_SPECS.map((spec) => {
    const item = byId.get(spec.id);
    const swatchSrc = `${SWATCH_DIR}/${spec.filename}`;
    if (!item || item.swatchSrc !== swatchSrc) {
      throw new Error(
        `Stitch ${spec.id} swatch is ${item?.swatchSrc ?? "missing"}, expected ${swatchSrc}.`,
      );
    }
    return {
      id: spec.id,
      label: spec.label,
      href: `/stitch/${spec.id}`,
      swatchSrc,
      stitchMultiple: item.stitchMultiple,
      sizeLabel: formatNiftyGiftyTreeSize(item.stitchMultiple),
    };
  });
}

export const NIFTY_GIFTY_STOCKING_CARD_COPY =
  "A mini Christmas stocking you can personalize with a small motif. The Knit Picks pattern includes the tree in the photo.";
