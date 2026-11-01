import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EASY_CUT_YARN_CUTTER,
  EASY_CUT_YARN_CUTTER_STRIPE_URL,
} from "../../data/shop/easyCutYarnCutter";
import {
  EASY_CUT_YARN_CUTTER_PATH,
  easyCutYarnCutterCheckoutHref,
  isEasyCutYarnCutterProductionBlocked,
  isEasyCutYarnCutterRoute,
} from "./easyCutYarnCutter";

const HOBBY_KNIT_NEEDLES_STRIPE_URL =
  "https://buy.stripe.com/5kQcN4eSqauD2v44u60oM0W";

const pagePath = resolve("src/pages/shop/accessories/easy-cut-yarn-cutter.astro");
const listingPath = resolve("src/components/shop/EasyCutYarnCutterListing.astro");

describe("Easy-Cut Yarn Cutter", () => {
  it("is published and uses its own Stripe Payment Link", () => {
    expect(EASY_CUT_YARN_CUTTER.published).toBe(true);
    expect(EASY_CUT_YARN_CUTTER.stripePaymentLink).toBe(
      "https://buy.stripe.com/4gMbJ0fWu0U3fhQe4G0oM0X",
    );
    expect(EASY_CUT_YARN_CUTTER_STRIPE_URL).toBe(EASY_CUT_YARN_CUTTER.stripePaymentLink);
    expect(EASY_CUT_YARN_CUTTER.stripePaymentLink).not.toBe(HOBBY_KNIT_NEEDLES_STRIPE_URL);
    expect(easyCutYarnCutterCheckoutHref()).toBe(
      "https://buy.stripe.com/4gMbJ0fWu0U3fhQe4G0oM0X",
    );
    expect(easyCutYarnCutterCheckoutHref()).not.toContain("?");
    expect(EASY_CUT_YARN_CUTTER.offerLabel).toBe("$9.99. Free U.S. shipping.");
    expect(EASY_CUT_YARN_CUTTER.shortDescription).toBe(
      "The cutter that won't get lost! Self-adhesive backing keeps it right where you need it.",
    );
    expect(EASY_CUT_YARN_CUTTER.imageSrc).toBe("/images/shop/easycut.jpg");
    expect(EASY_CUT_YARN_CUTTER.imageAlt).toBe("Easy-Cut yarn cutter");
    expect(EASY_CUT_YARN_CUTTER.imageWidth).toBe(493);
    expect(EASY_CUT_YARN_CUTTER.imageHeight).toBe(324);
    const imageDir = resolve("public/images/shop");
    expect(readdirSync(imageDir)).toContain("easycut.jpg");
    expect(existsSync(resolve("public/images/shop/easycut.jpg"))).toBe(true);
  });

  it("stays on the live shop while published and can still be held back", () => {
    expect(isEasyCutYarnCutterRoute(EASY_CUT_YARN_CUTTER_PATH)).toBe(true);
    expect(isEasyCutYarnCutterRoute("/shop/accessories/easy-cut-yarn-cutter/")).toBe(true);
    expect(isEasyCutYarnCutterProductionBlocked("www.knititnow.com")).toBe(false);
    expect(isEasyCutYarnCutterProductionBlocked("knititnow.com")).toBe(false);
    expect(isEasyCutYarnCutterProductionBlocked("localhost")).toBe(false);
    expect(isEasyCutYarnCutterProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(
      isEasyCutYarnCutterProductionBlocked("www.knititnow.com", {}, { published: false }),
    ).toBe(true);
    expect(
      isEasyCutYarnCutterProductionBlocked("kin-dev.netlify.app", {}, { published: false }),
    ).toBe(false);
  });

  it("puts the sales page and shop cards in the existing shop", () => {
    const page = readFileSync(pagePath, "utf8");
    const listing = readFileSync(listingPath, "utf8");
    const shop = readFileSync(resolve("src/pages/shop/index.astro"), "utf8");
    const accessories = readFileSync(resolve("src/pages/shop/accessories/index.astro"), "utf8");
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");

    expect(page).toContain("Buy Easy-Cut");
    expect(page).toContain("easyCutYarnCutterCheckoutHref");
    expect(page).toContain("{product.offerLabel}");
    expect(page).toContain("{product.shortDescription}");
    expect(page).toContain("U.S. orders only.");
    expect(page).toContain("self-adhesive");
    expect(page).toContain("stays in place for convenient use.");
    expect(page).toContain("Knitting machines");
    expect(page).toContain("Sewing machines");
    expect(page).toContain("Sergers");
    expect(page).toContain("Quilt frames");
    expect(page).toContain("a.cutter-buy:link");
    expect(page).toContain("a.cutter-buy:visited");
    expect(page).toContain("a.cutter-buy:hover");
    expect(page).toContain("a.cutter-buy:focus");
    expect(page).toContain("a.cutter-buy:focus-visible");
    expect(page).toContain("a.cutter-buy:active");
    expect(page).toContain("color: #ffffff");
    expect(page).toContain("height: auto");
    expect(page).not.toContain(HOBBY_KNIT_NEEDLES_STRIPE_URL);
    expect(page).not.toContain("myshopify.com");
    expect(page).not.toContain("—");
    expect(page).not.toMatch(/shipping (is )?not|undecided|unavailable/i);
    expect(listing).toContain("{product.offerLabel}");
    expect(listing).toContain("{product.shortDescription}");
    expect(shop).toContain("EasyCutYarnCutterListing");
    expect(accessories).toContain("EasyCutYarnCutterListing");
    expect(middleware).toContain("isEasyCutYarnCutterProductionBlocked");
  });
});
