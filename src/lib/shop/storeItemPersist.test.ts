import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readStoreCatalogSnapshot, listStoreItems, saveStoreItem, type StoreItemPaths } from "./storeItemCatalog";
import { saveStoreItemForRequest } from "./storeItemLive";
import {
  emptyStoreItemOverlay,
  mergeStoreCatalog,
  parseStoreItemOverlay,
  type StoreItemOverlay,
} from "./storeItemOverlay";
import {
  KIN_DEV_SITE_ID,
  PRODUCTION_SITE_ID,
  isProductionStoreSite,
  isKinDevStoreSite,
  resolveStoreItemWriteAccess,
  type StoreItemSiteEnv,
} from "./storeItemPersist";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultStoreItemPaths } from "./storeItemCatalog";

function copyCatalog(): StoreItemPaths {
  const dir = mkdtempSync(path.join(tmpdir(), "store-items-live-"));
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

function memoryBlob() {
  const memory = new Map<string, unknown>();
  return {
    memory,
    blob: {
      async readCatalog() {
        return memory.get("catalog") ?? null;
      },
      async writeCatalog(value: StoreItemOverlay) {
        memory.set("catalog", value);
      },
    },
  };
}

const kinDev = {
  hostname: "kin-dev.netlify.app",
  isViteDev: false,
  env: {
    CONTEXT: "production",
    SITE_ID: KIN_DEV_SITE_ID,
    SITE_NAME: "kin-dev",
    URL: "https://kin-dev.netlify.app",
  } satisfies StoreItemSiteEnv,
};

describe("store item site isolation", () => {
  it("writes project files only on localhost", () => {
    expect(resolveStoreItemWriteAccess({ hostname: "localhost", isViteDev: true }).mode).toBe("filesystem");
    expect(
      resolveStoreItemWriteAccess({
        hostname: "kin-dev.netlify.app",
        isViteDev: true,
        env: kinDev.env,
      }).mode,
    ).toBe("filesystem");
  });

  it("gives the published kin-dev and production sites separate blob saves", () => {
    const dev = resolveStoreItemWriteAccess(kinDev);
    const production = resolveStoreItemWriteAccess({
      hostname: "knititnow.com",
      env: {
        CONTEXT: "production",
        SITE_ID: PRODUCTION_SITE_ID,
        SITE_NAME: "knititnow",
        URL: "https://knititnow.com",
      },
    });
    const devWithoutContext = resolveStoreItemWriteAccess({
      hostname: "kin-dev.netlify.app",
      env: {
        SITE_ID: KIN_DEV_SITE_ID,
        SITE_NAME: "kin-dev",
        URL: "https://kin-dev.netlify.app",
      },
    });
    expect(dev).toEqual({ ok: true, mode: "blob", site: "kin-dev" });
    expect(devWithoutContext).toEqual({ ok: true, mode: "blob", site: "kin-dev" });
    expect(production).toEqual({ ok: true, mode: "blob", site: "production" });
    expect(isKinDevStoreSite(kinDev.env)).toBe(true);
    expect(isProductionStoreSite(kinDev.env)).toBe(false);
  });

  it("blocks deploy previews and branch deploys, including a preview hostname on a published site id", () => {
    const preview = resolveStoreItemWriteAccess({
      hostname: "deploy-preview-12--kin-dev.netlify.app",
      env: {
        CONTEXT: "deploy-preview",
        SITE_ID: KIN_DEV_SITE_ID,
        SITE_NAME: "kin-dev",
        URL: "https://kin-dev.netlify.app",
        DEPLOY_PRIME_URL: "https://deploy-preview-12--kin-dev.netlify.app",
      },
    });
    const branch = resolveStoreItemWriteAccess({
      hostname: "feature--kin-dev.netlify.app",
      env: { CONTEXT: "branch-deploy", SITE_ID: KIN_DEV_SITE_ID, SITE_NAME: "kin-dev" },
    });
    const spoofedHost = resolveStoreItemWriteAccess({
      hostname: "deploy-preview-4--knititnow.netlify.app",
      env: { CONTEXT: "production", SITE_ID: PRODUCTION_SITE_ID, URL: "https://knititnow.com" },
    });
    const wrongHost = resolveStoreItemWriteAccess({
      hostname: "kin-dev.netlify.app",
      env: { CONTEXT: "production", SITE_ID: PRODUCTION_SITE_ID, URL: "https://knititnow.com" },
    });
    expect(preview.ok).toBe(false);
    expect(branch.ok).toBe(false);
    expect(spoofedHost.ok).toBe(false);
    expect(wrongHost.ok).toBe(false);
    if (!preview.ok) expect(preview.error).toMatch(/deploy preview/i);
  });
});

describe("store item overlay", () => {
  it("replaces a matching cable, adds a new one once, and keeps the other cables", () => {
    const baseline = readStoreCatalogSnapshot(copyCatalog());
    const originalCount = baseline.cables.length;
    const overlay = emptyStoreItemOverlay();
    overlay.cables["104"] = {
      ...baseline.cables.find((row) => String(row.id) === "104"),
      shortdescription: "KIN-DEV REVIEW note",
    };
    overlay.cables["99001"] = {
      id: 99001,
      name: "KIN-DEV REVIEW accessory",
      price: 19.95,
      stripeLink: "",
      thumbnail: "Brother5.jpg",
      shortdescription: "Hidden review item",
      longDescription: "<p>Review only.</p>",
      active: "FALSE",
      sortOrder: 50,
    };
    const merged = mergeStoreCatalog(baseline, overlay);
    const again = mergeStoreCatalog(merged, overlay);
    expect(merged.cables.filter((row) => String(row.id) === "104")).toHaveLength(1);
    expect(merged.cables.find((row) => String(row.id) === "104")?.shortdescription).toBe("KIN-DEV REVIEW note");
    expect(merged.cables.filter((row) => String(row.id) === "99001")).toHaveLength(1);
    expect(merged.cables).toHaveLength(originalCount + 1);
    expect(again.cables.filter((row) => String(row.id) === "99001")).toHaveLength(1);
    expect(merged.cables.find((row) => String(row.id) === "101")).toBeTruthy();
  });

  it("keeps a later catalog file when that item was not saved", () => {
    const paths = copyCatalog();
    const baseline = readStoreCatalogSnapshot(paths);
    const overlay = emptyStoreItemOverlay();
    overlay.cables["104"] = {
      ...(baseline.cables.find((row) => String(row.id) === "104") as Record<string, unknown>),
      name: "Saved name",
    };
    const deployed = readStoreCatalogSnapshot(paths);
    const untouched = deployed.cables.find((row) => String(row.id) === "101");
    if (untouched) untouched.name = "Deployed name";
    const merged = mergeStoreCatalog(deployed, overlay);
    expect(merged.cables.find((row) => String(row.id) === "104")?.name).toBe("Saved name");
    expect(merged.cables.find((row) => String(row.id) === "101")?.name).toBe("Deployed name");
  });

  it("does not add a DesignaKnit product that is not in the deployed file", () => {
    const baseline = readStoreCatalogSnapshot(copyCatalog());
    const overlay = emptyStoreItemOverlay();
    overlay.software["extra"] = { id: "extra", title: "Extra", category: "DesignaKnit", active: true };
    const merged = mergeStoreCatalog(baseline, overlay);
    expect(merged.software.some((row) => String(row.id) === "extra")).toBe(false);
    expect(merged.software).toHaveLength(baseline.software.length);
  });

  it("rejects a saved catalog that is not the expected shape", () => {
    expect(parseStoreItemOverlay(null)?.version).toBe(1);
    expect(parseStoreItemOverlay({ version: 2 })).toBeNull();
    expect(parseStoreItemOverlay({ version: 1, cables: [] })).toBeNull();
  });
});

describe("hosted store item save", () => {
  it("stores the edit in the site catalog and leaves the project files unchanged", async () => {
    const paths = copyCatalog();
    const before = readFileSync(paths.cables, "utf8");
    const current = listStoreItems(paths).find((item) => item.kind === "cable" && item.id === "104");
    expect(current).toBeTruthy();
    const { blob, memory } = memoryBlob();
    const saved = await saveStoreItemForRequest(
      "edit",
      {
        kind: "cable",
        id: "104",
        title: current?.title,
        summary: `${current?.summary} KIN-DEV REVIEW note`,
        description: current?.description,
        imageFile: current?.imageFile,
        visible: current?.visible,
        sortOrder: current?.sortOrder,
        displayPrice: current?.displayPrice,
        checkoutUrl: current?.checkoutUrl,
      },
      { ...kinDev, paths, catalogBlob: blob },
    );
    expect(saved.ok).toBe(true);
    expect(readFileSync(paths.cables, "utf8")).toBe(before);
    const listed = await saveStoreItemForRequest(
      "create",
      {
        kind: "cable",
        title: "KIN-DEV REVIEW accessory",
        summary: "Hidden until reviewed",
        description: '<p>See <a href="/reference/DAK-brother-cables">the cable guide</a>.</p>',
        imageFile: "/media/store-items/kin-dev-review.png",
        visible: false,
        sortOrder: 80,
        displayPrice: "24.00",
        checkoutUrl: "https://vjzu11-86.myshopify.com/products/designaknit-magnet",
      },
      { ...kinDev, paths, catalogBlob: blob },
    );
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.item.visible).toBe(false);
    expect(listed.item.imageUrl).toBe("/media/store-items/kin-dev-review.png");
    expect(listed.item.checkoutUrl).toBe("https://vjzu11-86.myshopify.com/products/designaknit-magnet");
    expect(memory.get("catalog")).toBeTruthy();

    const preview = await saveStoreItemForRequest(
      "edit",
      { kind: "cable", id: listed.item.id, title: "Should not save" },
      {
        hostname: "deploy-preview-9--kin-dev.netlify.app",
        isViteDev: false,
        env: { ...kinDev.env, CONTEXT: "deploy-preview" },
        paths,
        catalogBlob: blob,
      },
    );
    expect(preview.ok).toBe(false);
    const stored = memory.get("catalog") as StoreItemOverlay;
    expect(stored.cables[listed.item.id]?.name).toBe("KIN-DEV REVIEW accessory");
  });

  it("still writes the local catalog file on localhost", () => {
    const paths = copyCatalog();
    const saved = saveStoreItem(
      "create",
      {
        kind: "cable",
        title: "Local accessory",
        summary: "File save",
        description: "",
        imageFile: "Brother5.jpg",
        visible: false,
        sortOrder: 70,
        displayPrice: "10.00",
        checkoutUrl: "",
      },
      paths,
    );
    expect(saved.ok).toBe(true);
    expect(readFileSync(paths.cables, "utf8")).toContain("Local accessory");
  });
});
