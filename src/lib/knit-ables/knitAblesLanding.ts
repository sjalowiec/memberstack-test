import {
  TEENAGE_KICKS_IMAGES,
  TEENAGE_KICKS_SOCKS_PATH,
} from "./teenageKicksSocks";
import {
  WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY,
  WORSTED_COLOR_BLOCK_SOCKS_IMAGES,
  WORSTED_COLOR_BLOCK_SOCKS_PATH,
  WORSTED_COLOR_BLOCK_SOCKS_TITLE,
} from "./worstedColorBlockSocks";

export const KNIT_ABLES_PATH = "/knit-ables";

export const KNIT_ABLES_CANONICAL_URL = "https://knititnow.com/knit-ables";

export const KNIT_ABLES_LOGO = {
  src: "/images/knit-ables/machine-knit-ables-logo.png",
  alt: "Machine Knit-ables knitted puzzle pieces",
  width: 1200,
  height: 1200,
} as const;

/** Compact alt text for the logo beside a Knit-able page title. */
export const KNIT_ABLES_PAGE_LOGO_ALT = "Machine Knit-ables";

export type KnitAbleLandingCard = {
  href: string;
  title: string;
  description: string;
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

export const KNIT_ABLES_CARDS: readonly KnitAbleLandingCard[] = [
  {
    href: TEENAGE_KICKS_SOCKS_PATH,
    title: "Colorful Self-Striping Socks",
    description:
      "Bright stripes from self-striping yarn, using the Basic Socks Pattern Builder.",
    image: TEENAGE_KICKS_IMAGES.hero,
  },
  {
    href: WORSTED_COLOR_BLOCK_SOCKS_PATH,
    title: WORSTED_COLOR_BLOCK_SOCKS_TITLE,
    description: WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY,
    image: WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero,
  },
];
