import { buildDropShoulderBuilderNewPatternHref } from "../patterns/patternStorage";

export const CAP_SLEEVE_TANK_PATH = "/knit-ables/cap-sleeve-tank";

export const CAP_SLEEVE_TANK_CANONICAL_URL =
  "https://knititnow.com/knit-ables/cap-sleeve-tank";

/** Sirdar Branch Out Tank pattern. Awin affiliate link. */
export const CAP_SLEEVE_TANK_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2F10969-branch-out-tank-knitting-pattern-in-sirdar-loveful-bio-blend-chunky";

/** Featured yarn shop page. Awin affiliate link. */
export const CAP_SLEEVE_TANK_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=101419&awinaffid=2040643&ued=https%3A%2F%2Fsirdar.com%2Fen%2Fproducts%2Fsirdar-loveful-bio-blend-dk-100g";

const IMAGE_DIR = "/images/knit-ables/branch-out-tank";

export const CAP_SLEEVE_TANK_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/branch-out-tank.webp`,
    alt: "Knit It Now drop shoulder sweater diagrams beside a cream cap-sleeve tank with a ribbed collar and an embroidered vine across the shoulder.",
    width: 601,
    height: 310,
    fileName: "branch-out-tank.webp",
  },
  yarn: {
    src: `${IMAGE_DIR}/sirdar_loveful_bio-blend.jpg`,
    alt: "Pink ball of Sirdar Loveful Bio Blend double knitting yarn, with a close-up of the fiber.",
    width: 778,
    height: 959,
    fileName: "sirdar_loveful_bio-blend.jpg",
  },
} as const;

export const CAP_SLEEVE_TANK_TITLE =
  "Turn a Drop Shoulder Sweater into a Cap-Sleeve Tank";

export const CAP_SLEEVE_TANK_DESIGN_HEADING = "Design It Your Way";

export const CAP_SLEEVE_TANK_HERO_COPY =
  "Love the look of Sirdar’s Branch Out Tank? Use it as inspiration to make your own version on the knitting machine.";

/** Phrase inside the design paragraph that links to the Drop Shoulder Sweater builder. */
export const CAP_SLEEVE_TANK_BUILDER_LINK_LABEL = "Drop Shoulder Sweater builder";

export const CAP_SLEEVE_TANK_DESIGN_COPY_BEFORE = "Start with a custom fit from our ";

export const CAP_SLEEVE_TANK_DESIGN_COPY_AFTER =
  ", leave off the sleeves, then choose a collar and finish the armholes. The builder gives you the body instructions for your measurements and gauge, leaving you free to add embroidery and the details that make it yours.";

export const CAP_SLEEVE_TANK_CARD_COPY =
  "Use the Drop Shoulder Sweater builder, omit the sleeves, and plan a collar and finished armholes for a cap-sleeve tank.";

export const CAP_SLEEVE_TANK_COLLAR_IDEA =
  "Plan a collar that works with the neckline you chose.";

/** Optional member video. Shown beside the collar suggestion, not in the builder CTA. */
export const CAP_SLEEVE_TANK_COLLAR_VIDEO = {
  href: "/videos/962",
  title: "Collars for Machine Knitters",
  prompt: "Need help with the collar?",
  accessLabel: "Members",
} as const;

export const CAP_SLEEVE_TANK_OWN_IDEAS = [
  "Embrace Sirdar’s embroidery or get creative.",
  "Plan a finished edge for each armhole.",
  CAP_SLEEVE_TANK_COLLAR_IDEA,
  "Use your own yarn and the gauge from your swatch.",
  "Leave Sirdar’s embroidery and exact shaping as their design.",
] as const;

export const CAP_SLEEVE_TANK_BUILD_STEPS = [
  "Choose a yarn that knits comfortably on your machine.",
  "Knit and measure a gauge swatch.",
  "Open the Drop Shoulder Sweater builder and start a new pattern.",
  "Choose a starting size, pullover or cardigan, neckline, fit, and sleeve length.",
  "Enter the stitch and row gauge from your swatch.",
  "Knit the body from the generated pattern, then finish the armholes and add the collar you planned.",
] as const;

export const CAP_SLEEVE_TANK_YARN = {
  heading: "Sirdar Loveful Bio Blend DK",
  paragraphs: [
    "A double knitting yarn in the same Loveful Bio Blend family as the chunky yarn used in the Sirdar tank pattern. Swatch it on your machine and enter the gauge you actually get. Another yarn that suits your machine can be used instead.",
  ],
  buttonLabel: "Explore Sirdar Loveful Bio Blend DK",
  href: CAP_SLEEVE_TANK_YARN_URL,
} as const;

/** Same new-pattern entry the Drop Shoulder landing page uses. */
export function capSleeveTankBuilderHref(): string {
  return buildDropShoulderBuilderNewPatternHref();
}
