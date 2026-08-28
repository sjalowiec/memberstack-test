import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MACHINE_SALES_HOLD } from "./machineSalesHold";
import {
  applyListingDelete,
  applyListingSave,
  getStorefrontHoldListings,
  listingIdFromBrandModel,
  listingTypeFromUnknown,
  normalizeMachineSalesListing,
  parseMachineSalesListingsFile,
  readMachineSalesListings,
  shopListingImageSrcs,
} from "./machineSalesListings";
import { sanitizeMachineSalesUploadFilename } from "./machineSalesImageUpload";

const ORIGINAL_HOLD_CARDS = [
  {
    name: "Taitexma TH860 Punchcard Knitting Machine",
    href: "https://vjzu11-86.myshopify.com/products/taitexma-th860-punchcard-knitting-machine",
    imageSrc: "/images/machines/8601.jpg",
    priceLabel: "$1,449",
    specs: ["Standard Gauge", "Punchcard", "200 needles"],
    shortHtml:
      "At 4.5mm this Taitexma <em>(tie-tex-ma)</em> machine is the perfect gauge for finer yarns and lighter weight knits.",
  },
  {
    name: "Taitexma TR-850 Standard Ribber",
    href: "https://vjzu11-86.myshopify.com/products/tr-850-taitexma-standard-ribber",
    imageSrc: "/images/machines/tr-850-ribber.jpg",
    priceLabel: "$1,399",
    specs: ["4.5 Standard Gauge", "200 needles"],
    shortHtml:
      "Expand your knitting machine's capabilities by making it easy to knit professional ribbing, cuffs, waistbands, collars, and a wide variety of textured stitch patterns.",
  },
  {
    name: "Taitexma Mid-Gauge TH/TR 160 Bundle",
    href: "https://vjzu11-86.myshopify.com/products/taitexma-mid-gauge-th-tr-160-bundle",
    imageSrc: "/images/machines/taitexma-th-tr-160-bundle.jpg",
    priceLabel: "$2,099",
    specs: ["Mid-Gauge 6mm", "164 needles", "Ribber included"],
    shortHtml:
      "Machine and ribber bundle. At 6mm this Taitexma <em>(tie-tex-ma)</em> machine is the perfect gauge for a wide range of yarns.",
  },
] as const;

describe("machine sales hold listings", () => {
  it("keeps the machine sales hold on", () => {
    expect(MACHINE_SALES_HOLD).toBe(true);
  });

  it("keeps the original three storefront cards and includes the later approved listings", () => {
    const listings = getStorefrontHoldListings();
    expect(listings).toHaveLength(6);
    expect(
      listings.slice(0, 3).map((row) => ({
        name: row.name,
        href: row.shopifyUrl,
        imageSrc: row.imageSrc,
        priceLabel: row.priceLabel,
        specs: row.specs,
        shortHtml: row.shortHtml,
      }))
    ).toEqual(ORIGINAL_HOLD_CARDS.map((card) => ({ ...card })));
    const th260 = listings.find((row) => row.id === "taitexma-th260");
    expect(th260).toMatchObject({
      name: "Taitexma TH260 Bulky",
      price: 1999,
      priceLabel: "$1,999",
      status: "available",
      listingType: "machine",
      shopifyUrl: "https://vjzu11-86.myshopify.com/products/taitexma-th260",
      imageSrc: "/images/machines/taxema-bulky1.jpg",
    });
    expect(listings.every((row) => row.status === "available")).toBe(true);
    expect(listings.every((row) => row.listingType === "machine")).toBe(true);
  });

  it("hides hidden listings from the storefront and keeps sold listings", () => {
    const seeded = readMachineSalesListings();
    const hidden = getStorefrontHoldListings(
      seeded.map((row, i) => (i === 0 ? { ...row, status: "hidden" as const } : row))
    );
    expect(hidden).toHaveLength(5);
    expect(hidden.some((row) => row.id === "taitexma-th860")).toBe(false);

    const sold = getStorefrontHoldListings(
      seeded.map((row, i) => (i === 1 ? { ...row, status: "sold" as const } : row))
    );
    expect(sold).toHaveLength(6);
    expect(sold.find((row) => row.id === "taitexma-tr-850")?.status).toBe("sold");
  });

  it("reuses only images already on current shop listings", () => {
    const images = shopListingImageSrcs(readMachineSalesListings());
    expect(images).toEqual([
      "/images/machines/8601.jpg",
      "/images/machines/tr-850-ribber.jpg",
      "/images/machines/taitexma-th-tr-160-bundle.jpg",
      "/images/machines/taxema-bulky1.jpg",
      "/images/machines/taitexma-tr260-ribber.jpg",
      "/images/machines/taitexma-th160-machine.jpg",
    ]);
    expect(images).not.toContain("/images/machines/taxema_bulky1.jpg");
  });

  it("does not import the historical machine catalog", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "lib", "machines", "machineSalesListings.ts"),
      "utf-8"
    );
    expect(source).not.toContain("referenceCatalog");
    expect(source).not.toContain("data/machines.json");
    expect(source).not.toContain("getAllMachines");
  });

  it("drives the hold shop page from admin-managed listings, not hardcoded products", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src", "pages", "shop", "machines.astro"),
      "utf-8"
    );
    expect(page).toContain("getStorefrontHoldListings");
    expect(page).not.toContain("TEMP_SHOPIFY_PRODUCTS");
    expect(page).toContain("MACHINE_SALES_HOLD");
    expect(page).toContain('listingType === "machine"');
    expect(page).toContain('listingType === "accessory"');
    expect(page).not.toContain('includes("ribber")');
    expect(page).not.toContain('includes("Ribber")');
  });

  it("does not offer catalog prefill on the shop-machines admin", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src", "pages", "admin", "shop-machines.astro"),
      "utf-8"
    );
    expect(page).not.toContain("Add from catalog");
    expect(page).not.toContain("Start from catalog");
    expect(page).not.toContain("catalogMachineId");
    expect(page).toContain("Add Machine");
    expect(page).toContain("ms-field-listingType");
    expect(page).toContain("data-delete");
    expect(page).toContain("window.confirm");
  });
});

describe("listing save helpers", () => {
  it("rejects an Available listing without a Shopify URL", () => {
    const result = normalizeMachineSalesListing({
      id: "test-machine",
      name: "Test",
      brand: "Taitexma",
      model: "X",
      status: "available",
      shopifyUrl: "",
      imageSrc: "/images/machines/8601.jpg",
      specs: [],
      shortHtml: "",
      price: 1,
      sortOrder: 40,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Shopify/i);
  });

  it("creates a new listing without replacing seeded rows", () => {
    const current = readMachineSalesListings();
    const applied = applyListingSave(current, {
      mode: "new",
      listing: {
        id: "taitexma-th260-test",
        name: "Taitexma TH260 Bulky Punchcard Knitting Machine",
        brand: "Taitexma",
        model: "TH260",
        price: 1999,
        priceLabel: "$1,999",
        shopifyUrl: "https://vjzu11-86.myshopify.com/products/taitexma-th260",
        status: "available",
        specs: ["Bulky/Chunky", "Punchcard", "114 needles"],
        shortHtml: "Bulky punchcard machine.",
        imageSrc: "/images/machines/taxema_bulky1.jpg",
        sortOrder: 40,
      },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.listings).toHaveLength(7);
    expect(applied.listings.find((row) => row.id === "taitexma-th860")?.shopifyUrl).toContain(
      "taitexma-th860-punchcard-knitting-machine"
    );
  });

  it("builds a slug id from brand and model", () => {
    expect(listingIdFromBrandModel("Taitexma", "TH260")).toBe("taitexma-th260");
  });

  it("defaults a missing listing type to machine so existing rows stay visible", () => {
    expect(listingTypeFromUnknown(undefined)).toBe("machine");
    expect(listingTypeFromUnknown("")).toBe("machine");
    expect(listingTypeFromUnknown("accessory")).toBe("accessory");
    expect(listingTypeFromUnknown("ribber")).toBe(null);
    const parsed = parseMachineSalesListingsFile(
      JSON.stringify([
        {
          id: "legacy-no-type",
          name: "Taitexma TR-850 Standard Ribber",
          brand: "Taitexma",
          model: "TR-850",
          status: "available",
          shopifyUrl: "https://example.com/products/tr-850",
          imageSrc: "/images/machines/tr-850-ribber.jpg",
          specs: [],
          shortHtml: "",
          price: 1,
          sortOrder: 20,
        },
      ]),
    );
    expect(parsed[0]?.listingType).toBe("machine");
  });

  it("lets an existing listing change from Machine to Accessory", () => {
    const current = readMachineSalesListings();
    const ribber = current.find((row) => row.id === "taitexma-tr-850");
    if (!ribber) throw new Error("expected seeded TR-850 listing");
    const applied = applyListingSave(current, {
      mode: "edit",
      listing: { ...ribber, listingType: "accessory" },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.listings.find((row) => row.id === "taitexma-tr-850")?.listingType).toBe(
      "accessory",
    );
    expect(applied.listings).toHaveLength(current.length);
  });

  it("deletes a listing from JSON without touching image paths", () => {
    const current = readMachineSalesListings();
    const deleted = current.find((row) => row.id === "taitexma-th160");
    expect(deleted?.imageSrc).toBe("/images/machines/taitexma-th160-machine.jpg");
    const applied = applyListingDelete(current, "taitexma-th160");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.listings.find((row) => row.id === "taitexma-th160")).toBeUndefined();
    expect(applied.listings).toHaveLength(current.length - 1);
    expect(shopListingImageSrcs(current)).toContain("/images/machines/taitexma-th160-machine.jpg");
  });
});

describe("image upload filename", () => {
  it("sanitizes a local filename and keeps a web-safe extension", () => {
    expect(sanitizeMachineSalesUploadFilename("My Photo (1).JPG", "image/jpeg")).toBe(
      "my-photo-1.jpg"
    );
    expect(sanitizeMachineSalesUploadFilename("ribber.png", "image/png")).toBe("ribber.png");
    expect(
      sanitizeMachineSalesUploadFilename("taitexma-tr260-ribber.jpg", "image/jpeg"),
    ).toBe("taitexma-tr260-ribber.jpg");
  });
});
