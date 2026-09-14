import { knitAbleSockBuilderHref } from "./links";

export const TEENAGE_KICKS_SOCKS_PATH = "/knit-ables/teenage-kicks-socks";

export const TEENAGE_KICKS_SOCKS_CANONICAL_URL =
  "https://knititnow.com/knit-ables/teenage-kicks-socks";

export const TEENAGE_KICKS_ORIGINAL_PATTERN_URL =
  "https://www.knitpicks.com/teenage-kicks-socks-free-knitting-pattern/p/56188";

export const TEENAGE_KICKS_STATIC_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fstatic-yarn%2Fc%2F5420382";

export const TEENAGE_KICKS_STROLL_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fstroll-yarn%2Fc%2F5420133";

const IMAGE_DIR = "/images/knit-ables/teenage-kicks-socks";

export const TEENAGE_KICKS_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/56188220_2.jpg`,
    alt: "A pair of colorful self-striping socks in yellow, orange, pink, purple, and green stripes, worn standing on a wood floor.",
    width: 150,
    height: 150,
    fileName: "56188220_2.jpg",
  },
  stripeProgression: {
    src: `${IMAGE_DIR}/56188220_3.jpg`,
    alt: "Colorful self-striping socks shown from the side, with one heel lifted to show the cuff, heel, and stripe progression.",
    width: 150,
    height: 150,
    fileName: "56188220_3.jpg",
  },
  staticYarn: {
    src: `${IMAGE_DIR}/static.jpg`,
    alt: "Two skeins of Knit Picks Static self-striping sock yarn in teal and green colorways.",
    width: 1000,
    height: 1000,
    fileName: "static.jpg",
  },
  strollYarn: {
    src: `${IMAGE_DIR}/stroll.jpg`,
    alt: "Two balls of Knit Picks Stroll fingering-weight yarn, one turquoise and one mustard gold.",
    width: 1000,
    height: 1000,
    fileName: "stroll.jpg",
  },
} as const;

export const TEENAGE_KICKS_CUSTOM_SUGGESTIONS = [
  "Choose Cuff to Toe or Toe Up construction",
  "Knit a simple ribbed cuff",
  "Make the leg approximately mid-calf length",
  "Use a self-striping fingering-weight sock yarn",
  "Match the beginning of the color sequence if you want the socks to look alike",
] as const;

export type KnitAbleYarnRecommendation = {
  heading: string;
  paragraphs: readonly string[];
  buttonLabel: string;
  href: string;
  image: (typeof TEENAGE_KICKS_IMAGES)[keyof typeof TEENAGE_KICKS_IMAGES];
  featured?: boolean;
};

export const TEENAGE_KICKS_YARN_RECOMMENDATIONS: readonly KnitAbleYarnRecommendation[] = [
  {
    heading: "For Effortless Stripes: Knit Picks Static",
    paragraphs: [
      "Static creates narrow, repeating bands of color with a slightly blended or speckled appearance. It is the easiest choice for getting a colorful look without manually changing yarns.",
    ],
    buttonLabel: "Shop Knit Picks Static Yarn",
    href: TEENAGE_KICKS_STATIC_YARN_URL,
    image: TEENAGE_KICKS_IMAGES.staticYarn,
    featured: true,
  },
  {
    heading: "For Your Own Color Story: Knit Picks Stroll",
    paragraphs: [
      "Choose colors from the Stroll yarn family and create your own stripe sequence. Use two colors for classic stripes or several colors for a playful scrappy look.",
      "You control the width of the stripes by changing yarn after your chosen number of rows.",
    ],
    buttonLabel: "Explore Knit Picks Stroll Yarn",
    href: TEENAGE_KICKS_STROLL_YARN_URL,
    image: TEENAGE_KICKS_IMAGES.strollYarn,
  },
];

export function teenageKicksSockBuilderHref(): string {
  return knitAbleSockBuilderHref();
}
