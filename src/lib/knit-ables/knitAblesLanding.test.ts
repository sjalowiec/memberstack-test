import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNIT_ABLES_CANONICAL_URL,
  KNIT_ABLES_CARDS,
  KNIT_ABLES_LOGO,
  KNIT_ABLES_PATH,
} from "./knitAblesLanding";
import {
  CAP_SLEEVE_TANK_CARD_COPY,
  CAP_SLEEVE_TANK_IMAGES,
  CAP_SLEEVE_TANK_PATH,
  CAP_SLEEVE_TANK_TITLE,
} from "./capSleeveTank";
import {
  COCO_LOCO_TANK_CARD_COPY,
  COCO_LOCO_TANK_IMAGES,
  COCO_LOCO_TANK_PATH,
  COCO_LOCO_TANK_TITLE,
} from "./cocoLocoTank";
import { TEENAGE_KICKS_IMAGES, TEENAGE_KICKS_SOCKS_PATH } from "./teenageKicksSocks";
import {
  VEST_IN_SHOW_CARD_COPY,
  VEST_IN_SHOW_IMAGES,
  VEST_IN_SHOW_PATH,
  VEST_IN_SHOW_TITLE,
} from "./vestInShow";
import {
  WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY,
  WORSTED_COLOR_BLOCK_SOCKS_IMAGES,
  WORSTED_COLOR_BLOCK_SOCKS_PATH,
  WORSTED_COLOR_BLOCK_SOCKS_TITLE,
} from "./worstedColorBlockSocks";

const landingSource = readFileSync(
  resolve("src/pages/knit-ables/index.astro"),
  "utf8",
);
const inspirationSource = readFileSync(
  resolve("src/pages/knit-ables/teenage-kicks-socks.astro"),
  "utf8",
);
const headerSource = readFileSync(resolve("src/components/Header.astro"), "utf8");

describe("Knit-ables landing page logo", () => {
  it("is the public /knit-ables landing page", () => {
    expect(KNIT_ABLES_PATH).toBe("/knit-ables");
    expect(KNIT_ABLES_CANONICAL_URL).toBe("https://knititnow.com/knit-ables");
    expect(landingSource).toContain("export const prerender = false");
    expect(landingSource).toContain("listPublicKnitAbleCards");
    expect(landingSource).toContain("applyKnitAbleCacheHeaders");
    expect(landingSource).toContain("KNIT_ABLES_LOGO");
    expect(landingSource).toContain('id="knit-ables-heading"');
  });

  it("uses the supplied Machine Knit-ables logo with CLS-safe sizing", () => {
    expect(KNIT_ABLES_LOGO.src).toBe("/images/knit-ables/machine-knit-ables-logo.png");
    expect(KNIT_ABLES_LOGO.alt).toBe("Machine Knit-ables knitted puzzle pieces");
    expect(KNIT_ABLES_LOGO.width).toBe(1200);
    expect(KNIT_ABLES_LOGO.height).toBe(1200);
    expect(existsSync(resolve("public/images/knit-ables/machine-knit-ables-logo.png"))).toBe(
      true,
    );
    expect(landingSource).toContain("src={logo.src}");
    expect(landingSource).toContain("alt={logo.alt}");
    expect(landingSource).toContain("width={logo.width}");
    expect(landingSource).toContain("height={logo.height}");
    expect(landingSource).toContain("width: min(100%, 160px)");
    expect(landingSource).toContain("width: min(100%, 220px)");
    expect(landingSource).toContain("align-items: start");
    expect(landingSource).toContain("object-fit: contain");
    expect(landingSource).toContain("overflow-x: hidden");
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*box-shadow/);
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*border:/);
    expect(landingSource).not.toMatch(/\.knit-ables-logo[\s\S]*background/);
  });

  it("does not add the logo to the site Header", () => {
    expect(headerSource).not.toContain("machine-knit-ables-logo.png");
    expect(inspirationSource).toContain("KnitAblePageHeader");
  });
});

describe("Knit-ables landing page cards", () => {
  it("keeps the earlier Knit-ables and adds the cap-sleeve tank", () => {
    expect(landingSource).toContain("publicCards.map");
    expect(landingSource).toContain("knit-ables-card-list");
    expect(landingSource).toContain("knit-ables-feature-card");
    expect(KNIT_ABLES_CARDS).toHaveLength(5);

    const vestInShow = KNIT_ABLES_CARDS[0];
    expect(vestInShow?.href).toBe(VEST_IN_SHOW_PATH);
    expect(vestInShow?.href).toBe("/knit-ables/vest-in-show");
    expect(vestInShow?.title).toBe(VEST_IN_SHOW_TITLE);
    expect(vestInShow?.title).toBe("Vest in Show");
    expect(vestInShow?.description).toBe(VEST_IN_SHOW_CARD_COPY);
    expect(vestInShow?.image.src).toBe(VEST_IN_SHOW_IMAGES.hero.src);
    expect(existsSync(resolve(`public${VEST_IN_SHOW_IMAGES.hero.src}`))).toBe(true);

    const cocoLocoTank = KNIT_ABLES_CARDS[1];
    expect(cocoLocoTank?.href).toBe(COCO_LOCO_TANK_PATH);
    expect(cocoLocoTank?.href).toBe("/knit-ables/coco-loco-tank");
    expect(cocoLocoTank?.title).toBe(COCO_LOCO_TANK_TITLE);
    expect(cocoLocoTank?.title).toBe("Coco Loco Tank");
    expect(cocoLocoTank?.description).toBe(COCO_LOCO_TANK_CARD_COPY);
    expect(cocoLocoTank?.image.src).toBe(COCO_LOCO_TANK_IMAGES.hero.src);
    expect(cocoLocoTank?.image.src).toBe("/images/knit-ables/coco-loco-tank.jpg");
    expect(existsSync(resolve(`public${COCO_LOCO_TANK_IMAGES.hero.src}`))).toBe(true);

    const capSleeveTank = KNIT_ABLES_CARDS[2];
    expect(capSleeveTank?.href).toBe(CAP_SLEEVE_TANK_PATH);
    expect(capSleeveTank?.href).toBe("/knit-ables/cap-sleeve-tank");
    expect(capSleeveTank?.title).toBe(CAP_SLEEVE_TANK_TITLE);
    expect(capSleeveTank?.description).toBe(CAP_SLEEVE_TANK_CARD_COPY);
    expect(capSleeveTank?.image.src).toBe(CAP_SLEEVE_TANK_IMAGES.hero.src);
    expect(existsSync(resolve(`public${CAP_SLEEVE_TANK_IMAGES.hero.src}`))).toBe(true);

    const teenageKicks = KNIT_ABLES_CARDS[3];
    expect(teenageKicks?.href).toBe(TEENAGE_KICKS_SOCKS_PATH);
    expect(teenageKicks?.href).toBe("/knit-ables/teenage-kicks-socks");
    expect(teenageKicks?.title).toBe("Colorful Self-Striping Socks");
    expect(teenageKicks?.description).toBe(
      "Bright stripes from self-striping yarn, using the Basic Socks Pattern Builder.",
    );
    expect(teenageKicks?.image.src).toBe(TEENAGE_KICKS_IMAGES.hero.src);
    expect(existsSync(resolve(`public${TEENAGE_KICKS_IMAGES.hero.src}`))).toBe(true);

    const worstedSocks = KNIT_ABLES_CARDS[4];
    expect(worstedSocks?.href).toBe(WORSTED_COLOR_BLOCK_SOCKS_PATH);
    expect(worstedSocks?.href).toBe("/knit-ables/worsted-color-block-socks");
    expect(worstedSocks?.title).toBe(WORSTED_COLOR_BLOCK_SOCKS_TITLE);
    expect(worstedSocks?.title).toBe("Worsted Color-Block Socks");
    expect(worstedSocks?.description).toBe(WORSTED_COLOR_BLOCK_SOCKS_CARD_COPY);
    expect(worstedSocks?.image.src).toBe(WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.src);
    expect(worstedSocks?.image.alt).toBe(WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.alt);
    expect(existsSync(resolve(`public${WORSTED_COLOR_BLOCK_SOCKS_IMAGES.hero.src}`))).toBe(
      true,
    );
  });
});
