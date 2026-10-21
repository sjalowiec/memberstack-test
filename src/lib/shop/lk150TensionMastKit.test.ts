import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LK150_SECOND_TENSION_MAST_KIT,
  TENSION_MAST_BENEFITS,
  TENSION_MAST_INCLUDED,
  TENSION_MAST_INSTALLATION,
  TENSION_MAST_LK150_ONLY,
  TENSION_MAST_NOT_INCLUDED,
  TENSION_MAST_SALES_FINAL,
  TENSION_MAST_US_SALES_ONLY,
} from "../../data/shop/lk150SecondTensionMastKit";
import {
  SHOP_PRODUCT_SLUG_PARAM,
  SHOP_PRODUCT_VIEW_EVENT,
  SHOP_SHOPIFY_CLICK_EVENT,
  SHOPIFY_PRODUCT_ID_PARAM,
  reportShopProductEvent,
  resetShopProductGaForTests,
  shouldReportShopProductToProductionGa,
} from "../analytics/shopProductGa";
import {
  LK150_TENSION_MAST_KIT_PATH,
  isLk150TensionMastKitRoute,
  isLk150TensionMastProductionBlocked,
  tensionMastCheckoutHref,
  tensionMastInstructionsHtml,
  tensionMastPhotos,
  tensionMastVimeoId,
  tensionMastYoutubeUrl,
} from "./lk150TensionMastKit";

const pagePath = resolve("src/pages/shop/accessories/lk150-second-tension-mast-kit.astro");

describe("LK150 tension mast kit", () => {
  it("uses the verified Shopify product for Buy Now and is published", () => {
    expect(LK150_SECOND_TENSION_MAST_KIT.shopifyUrl).toBe(
      "https://vjzu11-86.myshopify.com/products/lk150-second-tension-mast-kit",
    );
    expect(LK150_SECOND_TENSION_MAST_KIT.shopifyProductId).toBe("15535058157762");
    expect(LK150_SECOND_TENSION_MAST_KIT.shopifyVariantId).toBe("67874971877570");
    expect(LK150_SECOND_TENSION_MAST_KIT.published).toBe(true);
    expect(LK150_SECOND_TENSION_MAST_KIT.checkoutEnabled).toBe(true);
    expect(tensionMastCheckoutHref()).toBe(LK150_SECOND_TENSION_MAST_KIT.shopifyUrl);
    expect(
      tensionMastCheckoutHref({
        checkoutEnabled: false,
        shopifyUrl: LK150_SECOND_TENSION_MAST_KIT.shopifyUrl,
      }),
    ).toBeNull();
  });

  it("404s on production while unpublished and opens after publish", () => {
    expect(isLk150TensionMastKitRoute(LK150_TENSION_MAST_KIT_PATH)).toBe(true);
    expect(isLk150TensionMastKitRoute(`${LK150_TENSION_MAST_KIT_PATH}/`)).toBe(true);
    expect(isLk150TensionMastKitRoute("/shop/accessories")).toBe(false);
    expect(isLk150TensionMastProductionBlocked("www.knititnow.com")).toBe(false);
    expect(
      isLk150TensionMastProductionBlocked("www.knititnow.com", {}, { published: false }),
    ).toBe(true);
    expect(isLk150TensionMastProductionBlocked("localhost", {}, { published: false })).toBe(false);
    expect(
      isLk150TensionMastProductionBlocked("localhost", { isViteDev: true }, { published: false }),
    ).toBe(false);
    expect(
      isLk150TensionMastProductionBlocked("kin-dev.netlify.app", {}, { published: false }),
    ).toBe(false);
    expect(
      isLk150TensionMastProductionBlocked("www.knititnow.com", {}, { published: true }),
    ).toBe(false);
  });

  it("shows the two product photos and hides empty video and instructions", () => {
    expect(tensionMastPhotos(LK150_SECOND_TENSION_MAST_KIT)).toEqual([
      {
        src: "/images/shop/lk150-mast-kit.jpg",
        alt: "The five components included in the LK150 Second Tension Mast Kit.",
        placement: "product",
        width: 600,
        height: 450,
      },
      {
        src: "/images/shop/lk150-second-mast.png",
        alt: "LK150 knitting machine with a second tension mast installed and yarn threaded.",
        caption: "Shown installed on an LK150. Knitting machine and yarn are not included.",
        placement: "installed",
        width: 1087,
        height: 1447,
      },
    ]);
    expect(existsSync(resolve("public/images/shop/lk150-second-mast.png"))).toBe(true);
    expect(existsSync(resolve("public/images/shop/lk150-mast-kit.jpg"))).toBe(true);
    expect(LK150_SECOND_TENSION_MAST_KIT.vimeoId).toBe("1238151241");
    expect(LK150_SECOND_TENSION_MAST_KIT.youtubeUrl).toBe("");
    expect(LK150_SECOND_TENSION_MAST_KIT.installationInstructionsHtml).toBe("");
    expect(tensionMastVimeoId(LK150_SECOND_TENSION_MAST_KIT)).toBe("1238151241");
    expect(tensionMastVimeoId({ vimeoId: "not-a-video" })).toBeNull();
    expect(tensionMastVimeoId({ vimeoId: "12345" })).toBe("12345");
    expect(tensionMastYoutubeUrl(LK150_SECOND_TENSION_MAST_KIT)).toBeNull();
    expect(tensionMastYoutubeUrl({ youtubeUrl: "https://example.com/watch" })).toBeNull();
    expect(
      tensionMastYoutubeUrl({ youtubeUrl: "https://www.youtube.com/watch?v=abc" }),
    ).toBe("https://www.youtube.com/watch?v=abc");
    expect(tensionMastInstructionsHtml(LK150_SECOND_TENSION_MAST_KIT)).toBeNull();
    expect(tensionMastInstructionsHtml({ installationInstructionsHtml: "  " })).toBeNull();
    expect(tensionMastInstructionsHtml({ installationInstructionsHtml: "<p>Fit the base.</p>" })).toBe(
      "<p>Fit the base.</p>",
    );
  });

  it("is published with a shop listing and stays out of unrelated navigation", () => {
    const page = readFileSync(pagePath, "utf8");
    const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
    expect(middleware).toContain("isLk150TensionMastKitRoute");
    expect(middleware).toContain("isLk150TensionMastProductionBlocked");
    expect(page).toContain('name="robots" content="noindex, nofollow"');
    expect(page).toContain("data-pagefind-ignore");
    expect(page).toContain("skipAnalytics={!kit.published}");
    expect(page).not.toContain("myshopify.com");
    expect(page).not.toContain("LK150 owners");
    expect(page).not.toContain("data-ms-content");
    expect(page).toContain("TENSION_MAST_LK150_ONLY");
    expect(page).toContain("TENSION_MAST_US_SALES_ONLY");
    expect(page).toContain("TENSION_MAST_NOT_INCLUDED");
    expect(page).toContain("TENSION_MAST_INSTALLATION");
    expect(page).toContain("TENSION_MAST_BENEFITS");
    expect(page).toContain("All sales are final.");
    expect(page).toContain('class="kit-photo"');
    expect(page).toContain("See it installed");
    expect(page).toContain("VimeoEmbed");
    expect(page).toContain("autoplay={false}");
    expect(page).toContain("Watch in the Learning Library");
    expect(page).toContain('href="https://knititnow.com/videos/2216"');
    expect(page).toContain('placement === "product"');
    expect(page).toContain('placement === "installed"');
    expect(page).not.toContain('placement === "included"');
    expect(page).toContain("data-shop-shopify-click");
    expect(page).toContain("bootShopProductAnalytics");
    expect(page).not.toContain("object-fit: cover");
    expect(page).not.toContain("Turn the machine over");
    expect(page).not.toContain("Printed installation");
    expect(TENSION_MAST_LK150_ONLY).toBe("For the Silver Reed LK150 only.");
    expect(TENSION_MAST_US_SALES_ONLY).toBe("U.S. sales only.");
    expect(TENSION_MAST_INSTALLATION).toBe(
      "Installation uses a mounting socket attached underneath the machine.",
    );
    expect(TENSION_MAST_NOT_INCLUDED).toContain(
      "Knitting machine, carriage, yarn, and tools are not included.",
    );
    expect(TENSION_MAST_BENEFITS).toEqual([
      "Keep a second color threaded and ready.",
      "Set up yarn for Fair Isle, intarsia, and other multicolor knitting.",
      "Keep waste yarn ready between projects.",
    ]);
    expect(page).toContain('href="/contact/"');
    expect(TENSION_MAST_SALES_FINAL).toContain("contact us");
    expect(TENSION_MAST_INCLUDED).toEqual([
      "Auto tension mast",
      "Tension rod",
      "Tension guide/holder",
      "Yarn rod socket",
      "Socket base with mounting screw",
    ]);
    expect(LK150_SECOND_TENSION_MAST_KIT.introduction).toBe(
      "Keep a second yarn ready to knit. Add a second tension mast to your Silver Reed LK150 for Fair Isle, intarsia, and other multicolor projects, or keep waste yarn threaded and ready to use.",
    );
    expect(LK150_SECOND_TENSION_MAST_KIT.priceLabel).toBe("$54.95");
    expect(LK150_SECOND_TENSION_MAST_KIT.shippingLabel).toBe("plus shipping");
    expect(LK150_SECOND_TENSION_MAST_KIT.published).toBe(true);
    expect(page).toContain("!kit.published");
    expect(LK150_SECOND_TENSION_MAST_KIT.path).toBe("/shop/accessories/lk150-second-tension-mast-kit");
    expect(readFileSync(resolve("src/components/shop/Lk150TensionMastKitListing.astro"), "utf8")).toContain(
      "href={kit.path}",
    );

    for (const listing of ["src/pages/shop/index.astro", "src/pages/shop/accessories/index.astro"]) {
      expect(readFileSync(resolve(listing), "utf8")).toContain("Lk150TensionMastKitListing");
    }

    for (const listing of [
      "src/pages/shop/machines.astro",
      "src/components/Header.astro",
      "data/machines-for-sale.json",
    ]) {
      expect(readFileSync(resolve(listing), "utf8")).not.toContain("lk150-second-tension-mast-kit");
    }
  });
});

describe("shop product analytics", () => {
  it("stays off localhost, dev hosts, and unpublished drafts", () => {
    resetShopProductGaForTests();
    expect(shouldReportShopProductToProductionGa({ hostname: "localhost", isViteDev: true })).toBe(
      false,
    );
    expect(shouldReportShopProductToProductionGa({ hostname: "kin-dev.netlify.app" })).toBe(false);

    const calls: unknown[][] = [];
    const context = {
      now: 1_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      measurementIdConfigured: true,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    };

    expect(
      reportShopProductEvent(
        SHOP_PRODUCT_VIEW_EVENT,
        {
          slug: LK150_SECOND_TENSION_MAST_KIT.slug,
          shopifyProductId: LK150_SECOND_TENSION_MAST_KIT.shopifyProductId,
          published: false,
          checkoutEnabled: false,
        },
        context,
      ),
    ).toBe(false);
    expect(
      reportShopProductEvent(
        SHOP_SHOPIFY_CLICK_EVENT,
        {
          slug: LK150_SECOND_TENSION_MAST_KIT.slug,
          shopifyProductId: LK150_SECOND_TENSION_MAST_KIT.shopifyProductId,
          published: true,
          checkoutEnabled: false,
        },
        context,
      ),
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it("sends a product view and a Shopify click without personal information", () => {
    resetShopProductGaForTests();
    const calls: unknown[][] = [];
    const context = {
      now: 2_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      measurementIdConfigured: true,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    };
    const product = {
      slug: LK150_SECOND_TENSION_MAST_KIT.slug,
      shopifyProductId: LK150_SECOND_TENSION_MAST_KIT.shopifyProductId,
      published: true,
      checkoutEnabled: true,
    };

    expect(reportShopProductEvent(SHOP_PRODUCT_VIEW_EVENT, product, context)).toBe(true);
    expect(reportShopProductEvent(SHOP_SHOPIFY_CLICK_EVENT, product, { ...context, now: 3_000 })).toBe(
      true,
    );

    expect(calls).toEqual([
      [
        "event",
        SHOP_PRODUCT_VIEW_EVENT,
        {
          [SHOP_PRODUCT_SLUG_PARAM]: product.slug,
          [SHOPIFY_PRODUCT_ID_PARAM]: product.shopifyProductId,
          transport_type: "beacon",
        },
      ],
      [
        "event",
        SHOP_SHOPIFY_CLICK_EVENT,
        {
          [SHOP_PRODUCT_SLUG_PARAM]: product.slug,
          [SHOPIFY_PRODUCT_ID_PARAM]: product.shopifyProductId,
          transport_type: "beacon",
        },
      ],
    ]);
    const payload = JSON.stringify(calls);
    expect(payload).not.toMatch(/email|@/i);
  });
});
