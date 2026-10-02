import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MACHINE_SALES_HOLD } from "./machineSalesHold";
import {
  applyListingDelete,
  applyListingSave,
  getStorefrontHoldListings,
  isStorefrontRibberOrAccessory,
  listingGaugeLabel,
  listingIdFromBrandModel,
  listingTypeFromUnknown,
  normalizeMachineSalesListing,
  parseMachineSalesListingsFile,
  readMachineSalesListings,
  shopListingImageSrcs,
  storefrontBrandPanels,
  type MachineSalesListing,
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
    expect(listings).toHaveLength(8);
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
    const tr260 = listings.find((row) => row.id === "taitexma-tr260");
    expect(tr260).toMatchObject({
      name: "Taitexma TR260 Ribber",
      status: "available",
      listingType: "accessory",
      shopifyUrl: "https://vjzu11-86.myshopify.com/products/taitexma-tr260-ribber-attachment",
      imageSrc: "/images/machines/taitexma-tr260-ribber.jpg",
    });
    const th160 = listings.find((row) => row.id === "taitexma-th160");
    expect(th160).toMatchObject({
      name: "Taitexma TH160 Mid-Gauge Machine",
      status: "available",
      listingType: "machine",
      shopifyUrl: "https://vjzu11-86.myshopify.com/products/taitexma-mid-gauge-th160",
      imageSrc: "/images/machines/taitexma-th160-machine.jpg",
    });
    const lk150 = listings.find((row) => row.id === "silver-reed-lk150");
    expect(lk150).toMatchObject({
      name: "Silver Reed LK150",
      brand: "Silver Reed",
      status: "available",
      listingType: "machine",
      priceLabel: "$575",
      shopifyUrl: "https://vjzu11-86.myshopify.com/products/silver-reed-lk150",
    });
    const sk155 = listings.find((row) => row.id === "silver-reed-sk155");
    expect(sk155).toMatchObject({
      name: "SK155",
      brand: "Silver Reed",
      status: "available",
      listingType: "machine",
      priceLabel: "$1,750",
      shopifyUrl: "https://vjzu11-86.myshopify.com/products/sk155-bulky-machine",
    });
    expect(listings.every((row) => row.status === "available")).toBe(true);
    expect(listings.filter((row) => row.listingType === "machine")).toHaveLength(7);
    expect(listings.filter((row) => row.listingType === "accessory")).toHaveLength(1);
    const panels = storefrontBrandPanels(listings);
    expect(panels.find((panel) => panel.id === "silver-reed")?.machines.map((row) => row.id)).toEqual([
      "silver-reed-lk150",
      "silver-reed-sk155",
    ]);
  });

  it("hides hidden listings from the storefront and keeps sold listings", () => {
    const seeded = readMachineSalesListings();
    const hidden = getStorefrontHoldListings(
      seeded.map((row, i) => (i === 0 ? { ...row, status: "hidden" as const } : row))
    );
    expect(hidden).toHaveLength(7);
    expect(hidden.some((row) => row.id === "taitexma-th860")).toBe(false);

    const sold = getStorefrontHoldListings(
      seeded.map((row, i) => (i === 1 ? { ...row, status: "sold" as const } : row))
    );
    expect(sold).toHaveLength(8);
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
      "/images/machines/lk150-knitting-machine-1790963179128.jpg",
      "/images/machines/silver-reed-sk155-bulky-gauge-knitting-machine.jpg",
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
    expect(page).toContain("storefrontBrandPanels");
    expect(page).toContain("listingGaugeLabel");
    expect(page).toContain("Gauge:");
    expect(page).toContain('type="button"');
    expect(page).toContain("aria-pressed");
    expect(page).toContain("data-brand-catalog");
    expect(page).toContain("(tie-tex-ma)");
    expect(page).toContain("Taitexma machines are ordered in batches, so availability varies by shipment.");
    expect(page).toContain("Browse Taitexma");
    expect(page).toContain("Machines are available for customers in the United States only.");
    expect(page).toContain(
      'class="contact-modal-trigger" data-contact-source="shop-machines">Contact Sue</a>',
    );
    expect(page).not.toContain("These products are available to purchase now.");
    expect(page).toContain(
      "Explore Silver Reed knitting machines, from the portable LK150 to punchcard and electronic models.",
    );
    expect(page).toContain("Browse Silver Reed");
    expect(page).toContain("{!salesHold && <PageHead");
    expect(page).toContain("${panel.title} Machines");
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
    expect(page).not.toContain("Publish to Production");
    expect(page).not.toContain("/api/admin/machine-sales-publish");
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
    expect(applied.listings).toHaveLength(9);
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

function catalogListing(
  partial: Pick<MachineSalesListing, "id" | "name" | "brand" | "model"> &
    Partial<MachineSalesListing>
): MachineSalesListing {
  return {
    price: 1,
    priceLabel: "$1",
    shopifyUrl: "https://example.com/products/item",
    status: "available",
    listingType: "machine",
    specs: [],
    shortHtml: "",
    imageSrc: "/images/machines/8601.jpg",
    sortOrder: 0,
    ...partial,
  };
}

describe("storefront catalog sections", () => {
  const listings: MachineSalesListing[] = [
    catalogListing({
      id: "taitexma-th860",
      name: "Taitexma TH860 Punchcard Knitting Machine",
      brand: "Taitexma",
      model: "TH860",
      specs: ["Standard Gauge", "Punchcard", "200 needles"],
      sortOrder: 10,
    }),
    catalogListing({
      id: "taitexma-tr-850",
      name: "Taitexma TR-850 Standard Ribber",
      brand: "Taitexma",
      model: "TR-850",
      specs: ["4.5 Standard Gauge", "200 needles"],
      sortOrder: 20,
    }),
    catalogListing({
      id: "taitexma-th-tr-160-bundle",
      name: "Taitexma Mid-Gauge TH/TR 160 Bundle",
      brand: "Taitexma",
      model: "TH/TR 160 Bundle",
      specs: ["Mid-Gauge 6mm", "164 needles", "Ribber included"],
      shortHtml: "Machine and ribber bundle.",
      sortOrder: 30,
    }),
    catalogListing({
      id: "taitexma-tr260",
      name: "Taitexma TR260 Ribber",
      brand: "Taitexma",
      model: "TR260",
      listingType: "accessory",
      specs: ["Bulky/Chunky", "114 needles"],
      sortOrder: 50,
    }),
    catalogListing({
      id: "taitexma-th160",
      name: "Taitexma TH160 Mid-Gauge Machine",
      brand: "Taitexma",
      model: "TH160",
      specs: ["Mid-Gauge"],
      sortOrder: 60,
    }),
    catalogListing({
      id: "silver-reed-lk150",
      name: "Silver Reed LK150",
      brand: "Silver Reed",
      model: "LK150",
      specs: ["MId-Gauge", "Manual", "150 Needles"],
      sortOrder: 70,
    }),
    catalogListing({
      id: "no-gauge-machine",
      name: "Plain Knitter",
      brand: "Taitexma",
      model: "X",
      specs: ["Punchcard", "200 needles"],
      sortOrder: 80,
    }),
  ];

  it("keeps machines ahead of that brand's ribbers and accessories", () => {
    const panels = storefrontBrandPanels(listings);
    expect(panels.map((panel) => panel.title)).toEqual(["Taitexma", "Silver Reed"]);
    expect(panels[0]?.machines.map((row) => row.id)).toEqual([
      "taitexma-th860",
      "taitexma-th-tr-160-bundle",
      "taitexma-th160",
      "no-gauge-machine",
    ]);
    expect(panels[0]?.extras.map((row) => row.id)).toEqual([
      "taitexma-tr-850",
      "taitexma-tr260",
    ]);
    expect(panels[1]?.machines.map((row) => row.id)).toEqual(["silver-reed-lk150"]);
    expect(panels[1]?.extras).toEqual([]);
  });

  it("still returns both brand panels when a brand has no listings", () => {
    const panels = storefrontBrandPanels(
      listings.filter((row) => row.brand !== "Silver Reed"),
    );
    expect(panels.map((panel) => panel.id)).toEqual(["taitexma", "silver-reed"]);
    expect(panels[1]?.machines).toEqual([]);
    expect(panels[1]?.extras).toEqual([]);
  });

  it("keeps a machine-and-ribber bundle with the machines", () => {
    const bundle = listings.find((row) => row.id === "taitexma-th-tr-160-bundle");
    expect(bundle && isStorefrontRibberOrAccessory(bundle)).toBe(false);
  });

  it("shows a gauge only when a spec already states one", () => {
    expect(listingGaugeLabel(["Standard Gauge", "Punchcard"])).toBe("Standard Gauge");
    expect(listingGaugeLabel(["4.5 Standard Gauge", "200 needles"])).toBe("4.5 Standard Gauge");
    expect(listingGaugeLabel(["Mid-Gauge 6mm", "Ribber included"])).toBe("Mid-Gauge 6mm");
    expect(listingGaugeLabel(["Bulky/Chunky", "114 needles"])).toBe("Bulky/Chunky");
    expect(listingGaugeLabel(["MId-Gauge", "Manual"])).toBe("MId-Gauge");
    expect(listingGaugeLabel(["Punchcard", "200 needles"])).toBeNull();
    expect(listingGaugeLabel([])).toBeNull();
    expect(listingGaugeLabel(["Ribber included"])).toBeNull();
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
