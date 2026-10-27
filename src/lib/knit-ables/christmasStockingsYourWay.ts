import {
  CHRISTMAS_STOCKING_GRAPH_PAPER_HREF,
  CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL,
} from "../patterns/christmasStocking/christmasStockingMakeItYourOwn";
import {
  CHRISTMAS_STITCH_PATTERNS_LINK_LABEL,
  CHRISTMAS_STITCH_PATTERNS_PATH,
} from "../stitch/christmasStitchPatterns";
import { buildSockBuilderNewPatternHref } from "../patterns/christmasStocking/sockFreshStart";
import { CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING } from "../patterns/christmasStockingPatternLanding";
import type { KnitAbleInspirationPageContent } from "./inspirationPage";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PATH = "/knit-ables/christmas-stockings-your-way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL =
  "https://knititnow.com/knit-ables/christmas-stockings-your-way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE = "Christmas Stockings, Your Way";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_EYEBROW = "Hand to Machine Inspiration";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE =
  "Choose your size, use your yarn, and make it your own.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO =
  "The stockings in the photo are the Knit Picks Holiday Stockings, a hand-knitting pattern. Use them for ideas, then make your own on the machine.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION = `${CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE} ${CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO}`;

/** Knit Picks Holiday Stockings pattern. Awin affiliate link. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fholiday-stockings-knitting-pattern%2Fp%2F52323D";

/** Wool of the Andes Worsted shop page. Awin affiliate link. A shopping option, not a required yarn. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL =
  "https://www.awin1.com/cread.php?awinmid=89047&awinaffid=2040643&ued=https%3A%2F%2Fwww.knitpicks.com%2Fyarn%2Fwool-of-the-andes-worsted-yarn%2Fc%2F5420103";

const IMAGE_DIR = "/images/knit-ables/christmas-stockings";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES = {
  hero: {
    src: `${IMAGE_DIR}/christmas-stockings.png`,
    alt: "A person holding two red, white, and blue Christmas stockings, one with a snowflake and one with reindeer.",
    width: 403,
    height: 600,
    fileName: "christmas-stockings.png",
  },
} as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING = "Christmas Stocking builder";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL = "Christmas Stocking builder";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE = "The ";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER =
  " writes the machine-knitting instructions from the size and gauge you enter.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_HEADING =
  "Through the Eyes of a Machine Knitter";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_INTRO =
  "When I saw these stockings, I immediately started thinking about the possibilities. You could make a matching set, choose a different design for each family member, or use up some favorite yarn.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS = [
  {
    lead: "Start with the shape.",
    paragraphs: [
      "The Knit It Now stocking is knitted flat in one piece, with short-row shaping for the heel and toe. You can work from the cuff down or the toe up, then seam it when you’re finished.",
    ],
  },
  {
    lead: "Make it yours.",
    paragraphs: [
      "Choose your yarn and swatch on your machine. The Christmas Stocking Builder uses your gauge and the size you choose to create your instructions. You can use it with the machine you have, from an LK150 to an electronic machine.",
    ],
  },
  {
    lead: "Have fun with the design.",
    paragraphs: [
      "Love the snowflakes and reindeer? They’re in the separate Knit Picks hand-knitting pattern. Or plan your own.",
      [
        {
          label: CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL,
          href: CHRISTMAS_STOCKING_GRAPH_PAPER_HREF,
        },
      ],
      [
        {
          label: CHRISTMAS_STITCH_PATTERNS_LINK_LABEL,
          href: CHRISTMAS_STITCH_PATTERNS_PATH,
        },
      ],
      "Check the width of the design against your stocking’s stitch count as you plan.",
    ],
  },
  {
    lead: "Sue’s tip:",
    paragraphs: [
      "I’d keep the heel and toe in a single color and use the leg and foot to show off the colorwork.",
    ],
    callout: true,
  },
] as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HELP =
  "You get stitch and row counts, the short-row heel and toe, and finishing directions, including the optional hanging loop.";

/** Same membership rule as the Christmas Stocking pattern landing page. This page itself stays readable. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY = [
  "The builder is included with a paid Knit It Now membership, and there is nothing extra to buy for this pattern.",
  "Stockings you create remain in your account. If your membership ends, you can still view, print, and download them. Editing, recalculating, and creating new stockings require an active membership.",
] as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING = "Knit Picks Holiday Stockings";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY =
  "This is the original hand-knitting pattern, separate from the Knit It Now machine-knitting builder. Shop it when you want the snowflake and reindeer charts.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL = "Shop the Knit Picks Pattern";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING = "Yarn inspiration";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_YARN = {
  heading: "Wool of the Andes Worsted",
  paragraphs: [
    "Wool of the Andes Worsted is one yarn you can shop for this project. Swatch it on your machine and enter the gauge you get.",
  ],
  buttonLabel: "Shop Wool of the Andes Worsted",
  href: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_URL,
} as const;

export const CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE =
  "These are affiliate links. If you purchase through them, Knit It Now may earn a commission at no additional cost to you.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CARD_COPY =
  "Take inspiration from these Knit Picks stockings, then use the Christmas Stocking builder to create your machine knitting instructions at your gauge.";

export const CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL = "Create Your Christmas Stocking";

/** Same visitor actions as the Christmas Stocking landing page. The button opens a new stocking in the builder. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_CTA = {
  ...CHRISTMAS_STOCKING_PATTERN_BUILDER_LANDING.cta,
  memberLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_CTA_LABEL,
};

/** New Christmas Stocking, the same entry the landing-page member CTA uses. */
export function christmasStockingsYourWayBuilderHref(): string {
  return buildSockBuilderNewPatternHref();
}

/** Page content for the shared Knit-able inspiration template. */
export const CHRISTMAS_STOCKINGS_YOUR_WAY_PAGE: KnitAbleInspirationPageContent = {
  path: CHRISTMAS_STOCKINGS_YOUR_WAY_PATH,
  canonicalUrl: CHRISTMAS_STOCKINGS_YOUR_WAY_CANONICAL_URL,
  title: CHRISTMAS_STOCKINGS_YOUR_WAY_TITLE,
  eyebrow: CHRISTMAS_STOCKINGS_YOUR_WAY_EYEBROW,
  showLogo: false,
  description: CHRISTMAS_STOCKINGS_YOUR_WAY_DESCRIPTION,
  hero: {
    src: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.src,
    alt: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.alt,
    width: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.width,
    height: CHRISTMAS_STOCKINGS_YOUR_WAY_IMAGES.hero.height,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
  },
  tagline: CHRISTMAS_STOCKINGS_YOUR_WAY_TAGLINE,
  intro: CHRISTMAS_STOCKINGS_YOUR_WAY_INTRO,
  perspective: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_HEADING,
    intro: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_INTRO,
    introVoice: true,
    points: CHRISTMAS_STOCKINGS_YOUR_WAY_PERSPECTIVE_POINTS,
  },
  builder: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HEADING,
    introduction: {
      before: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_BEFORE,
      link: {
        label: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_LINK_LABEL,
        href: christmasStockingsYourWayBuilderHref(),
      },
      after: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_COPY_AFTER,
    },
    steps: [],
    closing: [
      { text: CHRISTMAS_STOCKINGS_YOUR_WAY_BUILDER_HELP },
      ...CHRISTMAS_STOCKINGS_YOUR_WAY_MEMBERSHIP_COPY.map((text) => ({ text })),
    ],
    cta: CHRISTMAS_STOCKINGS_YOUR_WAY_CTA,
  },
  pattern: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_HEADING,
    copy: CHRISTMAS_STOCKINGS_YOUR_WAY_INSPIRED_COPY,
    linkLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_PATTERN_LINK_LABEL,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_ORIGINAL_PATTERN_URL,
  },
  yarn: {
    heading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN_HEADING,
    cardHeading: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.heading,
    paragraphs: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.paragraphs,
    buttonLabel: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.buttonLabel,
    href: CHRISTMAS_STOCKINGS_YOUR_WAY_YARN.href,
  },
  affiliateDisclosure: CHRISTMAS_STOCKINGS_YOUR_WAY_AFFILIATE_DISCLOSURE,
};
