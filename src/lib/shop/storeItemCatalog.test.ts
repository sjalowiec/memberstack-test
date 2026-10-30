import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeCsvRow, splitCsvRecords } from "./storeItemCsv";
import {
  cableImageUrl,
  defaultStoreItemPaths,
  listStoreItems,
  saveStoreItem,
  type StoreItemPaths,
} from "./storeItemCatalog";
import { saveStoreItemImage } from "./storeItemImage";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function copyCatalog(): StoreItemPaths {
  const dir = mkdtempSync(path.join(tmpdir(), "store-items-"));
  const source = defaultStoreItemPaths();
  const paths: StoreItemPaths = {
    cables: path.join(dir, "cables.json"),
    printables: path.join(dir, "printables.json"),
    software: path.join(dir, "software.json"),
    ebooksCsv: path.join(dir, "ebooks.csv"),
    ebookShopify: path.join(dir, "shopify.json"),
  };
  for (const key of Object.keys(paths) as (keyof StoreItemPaths)[]) {
    writeFileSync(paths[key], readFileSync(source[key]));
  }
  return paths;
}

describe("store item csv", () => {
  it("keeps commas and quotes inside a description", () => {
    const row = serializeCsvRow(["418", 'Say "hello"', "14.95"]);
    const parsed = splitCsvRecords(row).records[0];
    expect(parsed).toBe(row);
    expect(row).toContain('""hello""');
  });
});

describe("store item catalog", () => {
  it("loads the live shop catalogs", () => {
    const items = listStoreItems();
    expect(items.some((item) => item.kind === "cable" && item.id === "101" && item.title.includes("Brother"))).toBe(
      true,
    );
    expect(items.filter((item) => item.kind === "download")).toHaveLength(4);
    expect(items.filter((item) => item.kind === "software")).toHaveLength(4);
    expect(items.filter((item) => item.kind === "ebook").length).toBeGreaterThan(20);
    const rulers = items.find((item) => item.id === "charting-rulers");
    expect(rulers?.capabilities.canEditCheckout).toBe(false);
    expect(rulers?.capabilities.canEditPrice).toBe(false);
  });

  it("edits a cable description and keeps the other cables", () => {
    const paths = copyCatalog();
    const before = listStoreItems(paths);
    const cable = before.find((item) => item.kind === "cable" && item.id === "104");
    expect(cable).toBeTruthy();
    const saved = saveStoreItem(
      "edit",
      {
        kind: "cable",
        id: "104",
        title: cable?.title,
        summary: "Curl cord overview",
        description: '<p>See the <a href="/reference/DAK-brother-cables">cable guide</a>.</p>',
        imageFile: cable?.imageFile,
        visible: true,
        sortOrder: cable?.sortOrder,
        displayPrice: cable?.displayPrice,
        checkoutUrl: cable?.checkoutUrl,
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.item.description).toContain("/reference/DAK-brother-cables");
    const after = listStoreItems(paths).filter((item) => item.kind === "cable");
    expect(after).toHaveLength(before.filter((item) => item.kind === "cable").length);
    expect(after.find((item) => item.id === "101")?.title).toBe(before.find((item) => item.id === "101")?.title);
  });

  it("keeps entered cable fields when checkout is rejected", () => {
    const paths = copyCatalog();
    const original = readFileSync(paths.cables, "utf8");
    const saved = saveStoreItem(
      "edit",
      {
        kind: "cable",
        id: "101",
        title: "Brother Link 5 USB Cable",
        summary: "still here",
        description: "<p>still here</p>",
        imageFile: "Brother5.jpg",
        visible: true,
        sortOrder: 1,
        displayPrice: "225",
        checkoutUrl: "https://example.com/not-stripe",
      },
      paths,
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error).toMatch(/Shopify or Stripe/i);
    expect(readFileSync(paths.cables, "utf8")).toBe(original);
  });

  it("creates a cable that can be hidden from the shop", () => {
    const paths = copyCatalog();
    const saved = saveStoreItem(
      "create",
      {
        kind: "cable",
        title: "Verification Cable",
        summary: "A local test cable",
        description: '<p>Watch the <a href="/videos/example">setup video</a>.</p>',
        imageFile: "Brother5.jpg",
        visible: false,
        sortOrder: 90,
        displayPrice: "12.50",
        checkoutUrl: "",
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.item.visible).toBe(false);
    expect(saved.item.shopHref).toBe(`/shop/cables/${saved.item.id}`);
    expect(saved.item.checkoutUrl).toBe("");
  });

  it("encodes spaces and brackets in cable image URLs without renaming the file", () => {
    const paths = copyCatalog();
    const image = "[38DAKCPELS] Passap E6000 Link Switch (EL13SW).jpg";
    expect(cableImageUrl("magnet.jpg")).toBe("/images/shop/designaknit/magnet.jpg");
    expect(cableImageUrl("Brother5.jpg")).toBe("/images/shop/designaknit/Brother5.jpg");
    expect(cableImageUrl(image)).toBe(`/images/shop/designaknit/${encodeURIComponent(image)}`);
    const saved = saveStoreItem(
      "create",
      {
        kind: "cable",
        title: "Bracket Image Cable",
        summary: "Summary",
        description: "<p>Detail</p>",
        imageFile: image,
        visible: true,
        sortOrder: 99,
        displayPrice: "99.75",
        checkoutUrl: "https://vjzu11-86.myshopify.com/products/example",
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.item.imageFile).toBe(image);
    expect(saved.item.imageUrl).toBe(`/images/shop/designaknit/${encodeURIComponent(image)}`);
    expect(saved.item.displayPrice).toBe("99.75");
  });

  it("does not change a locked download payment link", () => {
    const paths = copyCatalog();
    const original = readFileSync(paths.printables, "utf8");
    const rulers = listStoreItems(paths).find((item) => item.id === "charting-rulers");
    const saved = saveStoreItem(
      "edit",
      {
        kind: "download",
        id: "charting-rulers",
        title: rulers?.title,
        summary: rulers?.summary,
        description: `${rulers?.description} <a href="/reference/gauge">Gauge help</a>`,
        imageFile: rulers?.imageFile,
        detailImageFile: rulers?.detailImageFile,
        sortOrder: 1,
        checkoutUrl: "https://buy.stripe.com/different",
        downloadFile: rulers?.downloadFile,
        vimeoId: rulers?.vimeoId,
        includesText: rulers?.includesText,
        salesFocus: rulers?.salesFocus,
      },
      paths,
    );
    expect(saved.ok).toBe(false);
    expect(readFileSync(paths.printables, "utf8")).toBe(original);
  });

  it("creates a download and keeps description links", () => {
    const paths = copyCatalog();
    const saved = saveStoreItem(
      "create",
      {
        kind: "download",
        title: "Swatch Notes",
        summary: "A worksheet",
        description: '<p>See <a href="/reference/gauge">gauge reference</a>.</p>',
        imageFile: "/images/shop/downloads/gauge-rulers.webp",
        detailImageFile: "/images/shop/downloads/gauge-rulers.webp",
        sortOrder: 1,
        checkoutUrl: "",
        downloadFile: "/downloads/shop/gauge-rulers.pdf",
        vimeoId: "260683875",
        includesText: "One sheet\nA second sheet",
        salesFocus: "Keep notes.",
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.item.id).toBe("swatch-notes");
    expect(saved.item.sortOrder).toBe(1);
    expect(saved.item.description).toContain("/reference/gauge");
    expect(saved.item.vimeoId).toBe("260683875");
    expect(listStoreItems(paths).filter((item) => item.kind === "download")[0]?.id).toBe("swatch-notes");
  });

  it("rejects a DesignaKnit rename and a new DesignaKnit product", () => {
    const paths = copyCatalog();
    const original = readFileSync(paths.software, "utf8");
    const renamed = saveStoreItem(
      "edit",
      {
        kind: "software",
        id: "dak-complete",
        title: "A different name",
        summary: "Full package",
        displayPrice: "$500",
        checkoutUrl: "https://vjzu11-86.myshopify.com/products/designaknit-complete",
        visible: true,
        recommended: true,
      },
      paths,
    );
    expect(renamed.ok).toBe(false);
    const created = saveStoreItem("create", { kind: "software", title: "Extra" }, paths);
    expect(created.ok).toBe(false);
    expect(readFileSync(paths.software, "utf8")).toBe(original);
  });

  it("edits an eBook description without rewriting the other rows", () => {
    const paths = copyCatalog();
    const before = readFileSync(paths.ebooksCsv, "utf8");
    const ebook = listStoreItems(paths).find((item) => item.kind === "ebook" && item.id === "675");
    expect(ebook?.description).toBeTruthy();
    const saved = saveStoreItem(
      "edit",
      {
        kind: "ebook",
        id: "675",
        title: ebook?.title,
        summary: ebook?.summary,
        description: `${ebook?.description}<p><a href="/reference/raglan">Raglan reference</a></p>`,
        imageFile: ebook?.imageFile,
        downloadFile: ebook?.downloadFile,
        visible: ebook?.visible,
        displayPrice: ebook?.displayPrice,
        checkoutUrl: ebook?.checkoutUrl,
        subscriberFree: ebook?.subscriberFree,
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.item.description).toContain("/reference/raglan");
    const afterLines = readFileSync(paths.ebooksCsv, "utf8").split(/\r?\n/);
    const beforeLines = before.split(/\r?\n/);
    const changed = afterLines.filter((line, index) => line !== beforeLines[index]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("Raglan reference");
    expect(readFileSync(paths.ebookShopify, "utf8")).toBe(readFileSync(defaultStoreItemPaths().ebookShopify, "utf8"));
  });
});

describe("store item images", () => {
  it("writes a png into the cable image folder", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "store-image-"));
    const saved = saveStoreItemImage(
      "cable",
      { filename: "My Cover.PNG", mimeType: "image/png", dataBase64: PNG_1X1 },
      { publicDir: dir },
    );
    expect(saved.filename).toBe("my-cover.png");
    expect(saved.url).toBe("/images/shop/designaknit/my-cover.png");
    expect(readFileSync(path.join(dir, "images", "shop", "designaknit", saved.filename)).length).toBeGreaterThan(10);
  });

  it("rejects a file that is not an image", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "store-image-"));
    expect(() =>
      saveStoreItemImage(
        "ebook",
        { filename: "notes.txt", mimeType: "image/png", dataBase64: Buffer.from("hello").toString("base64") },
        { publicDir: dir },
      ),
    ).toThrow(/JPG, PNG, or WebP/);
  });
});
