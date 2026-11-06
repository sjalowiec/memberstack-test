import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOBBY_KNIT_NEEDLES,
  HOBBY_KNIT_NEEDLES_STRIPE_URL,
} from "../../data/shop/hobbyKnitNeedles";
import {
  HOBBY_KNIT_NEEDLES_PATH,
  hobbyKnitNeedlesCheckoutHref,
  isHobbyKnitNeedlesProductionBlocked,
  isHobbyKnitNeedlesRoute,
} from "./hobbyKnitNeedles";

const pagePath = resolve("src/pages/shop/accessories/hobby-knit-replacement-needles.astro");
const listingPath = resolve("src/components/shop/HobbyKnitNeedlesListing.astro");

describe("Hobby Knit replacement needles", () => {
  it("is published and uses the exact Stripe Payment Link", () => {
    expect(HOBBY_KNIT_NEEDLES.published).toBe(true);
    expect(HOBBY_KNIT_NEEDLES.stripePaymentLink).toBe(
      "https://buy.stripe.com/5kQcN4eSqauD2v44u60oM0W",
    );
    expect(HOBBY_KNIT_NEEDLES_STRIPE_URL).toBe(HOBBY_KNIT_NEEDLES.stripePaymentLink);
    expect(hobbyKnitNeedlesCheckoutHref()).toBe(
      "https://buy.stripe.com/5kQcN4eSqauD2v44u60oM0W",
    );
    expect(HOBBY_KNIT_NEEDLES.priceLabel).toBe("$29.95 per set of 3");
    expect(HOBBY_KNIT_NEEDLES.cardPriceLabel).toBe("$29.95");
    expect(HOBBY_KNIT_NEEDLES.cardNote).toBe("Set of 3. Free U.S. shipping.");
    expect(HOBBY_KNIT_NEEDLES.imageSrc).toBe("/images/shop/hobby-knit-needles.jpg");
    expect(HOBBY_KNIT_NEEDLES.imageAlt).toBe(
      "Three Hobby Knit replacement needles beside a ruler for scale.",
    );
    expect(existsSync(resolve("public/images/shop/hobby-knit-needles.jpg"))).toBe(true);
  });

  it("is available on production when published and 404s while unpublished", () => {
    expect(isHobbyKnitNeedlesRoute(HOBBY_KNIT_NEEDLES_PATH)).toBe(true);
    expect(isHobbyKnitNeedlesRoute("/shop/accessories/hobby-knit-replacement-needles/")).toBe(
      true,
    );
    expect(isHobbyKnitNeedlesProductionBlocked("www.knititnow.com")).toBe(false);
    expect(isHobbyKnitNeedlesProductionBlocked("knititnow.com")).toBe(false);
    expect(
      isHobbyKnitNeedlesProductionBlocked("www.knititnow.com", {}, { published: false }),
    ).toBe(true);
    expect(
      isHobbyKnitNeedlesProductionBlocked("knititnow.com", {}, { published: false }),
    ).toBe(true);
    expect(isHobbyKnitNeedlesProductionBlocked("localhost")).toBe(false);
    expect(
      isHobbyKnitNeedlesProductionBlocked("localhost", { isViteDev: true }),
    ).toBe(false);
    expect(isHobbyKnitNeedlesProductionBlocked("deploy-preview.netlify.app")).toBe(false);
    expect(
      isHobbyKnitNeedlesProductionBlocked("www.knititnow.com", {}, { published: true }),
    ).toBe(false);
  });

  it("puts the sales page and shop card in the existing shop without a second product", () => {
    const page = readFileSync(pagePath, "utf8");
    const listing = readFileSync(listingPath, "utf8");
    const shop = readFileSync(resolve("src/pages/shop/index.astro"), "utf8");
    const accessories = readFileSync(resolve("src/pages/shop/accessories/index.astro"), "utf8");
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");

    expect(page).toContain("a.needle-buy:link");
    expect(page).toContain("a.needle-buy:visited");
    expect(page).toContain("a.needle-buy:hover");
    expect(page).toContain("a.needle-buy:focus");
    expect(page).toContain("a.needle-buy:focus-visible");
    expect(page).toContain("a.needle-buy:active");
    expect(page).toContain("Buy a Set of 3");
    expect(page).toContain("hobbyKnitNeedlesCheckoutHref");
    expect(page).toContain('href="/contact/"');
    expect(page).toContain("unused vintage needles from the remaining original inventory");
    expect(page).toContain("Limited remaining stock. U.S. orders only.");
    expect(page).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(page).toContain("data-hobby-knit-enlarge");
    expect(page).not.toContain("myshopify.com");
    expect(page).not.toContain("—");
    expect(listing).toContain("{product.cardNote}");
    expect(shop).toContain("HobbyKnitNeedlesListing");
    expect(accessories).toContain("HobbyKnitNeedlesListing");
    expect(middleware).toContain("isHobbyKnitNeedlesProductionBlocked");
  });
});
