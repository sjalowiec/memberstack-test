/**
 * Localhost saves the catalog files. kin-dev and production save a blob
 * overlay on top of the files shipped with that site's deploy.
 */
import { getStore } from "@netlify/blobs";
import {
  listStoreItems,
  readStoreCatalogSnapshot,
  saveStoreItem,
  type StoreItem,
  type StoreItemInput,
  type StoreItemPaths,
  type StoreItemSaveResult,
} from "./storeItemCatalog";
import {
  listMergedStoreItems,
  mergeStoreCatalog,
  parseStoreItemOverlay,
  saveStoreItemOnOverlay,
  type StoreItemOverlay,
} from "./storeItemOverlay";
import {
  resolveStoreItemWriteAccess,
  shouldReadStoreItemOverlay,
  type StoreItemSiteEnv,
  type StoreItemWriteAccess,
} from "./storeItemPersist";

export const STORE_ITEM_CATALOG_STORE = "store-items-catalog";
export const STORE_ITEM_CATALOG_KEY = "catalog";

export type StoreItemCatalogBlob = {
  readCatalog(): Promise<unknown>;
  writeCatalog(value: StoreItemOverlay): Promise<void>;
};

export function netlifyStoreItemCatalogBlob(): StoreItemCatalogBlob {
  const store = getStore({
    name: STORE_ITEM_CATALOG_STORE,
    consistency: "strong",
  });
  return {
    readCatalog: () => store.get(STORE_ITEM_CATALOG_KEY, { type: "json" }),
    writeCatalog: (value) => store.setJSON(STORE_ITEM_CATALOG_KEY, value),
  };
}

export type StoreItemRequestContext = {
  hostname?: string | null;
  isViteDev?: boolean;
  env?: StoreItemSiteEnv;
  paths?: StoreItemPaths;
  catalogBlob?: StoreItemCatalogBlob;
};

const READ_ERROR = "The saved catalog could not be read. Nothing was changed.";

async function readOverlay(
  blob: StoreItemCatalogBlob,
): Promise<{ ok: true; overlay: StoreItemOverlay } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = await blob.readCatalog();
  } catch {
    return { ok: false, error: READ_ERROR };
  }
  const overlay = parseStoreItemOverlay(raw);
  if (!overlay) return { ok: false, error: READ_ERROR };
  return { ok: true, overlay };
}

export async function listStoreItemsForRequest(
  context: StoreItemRequestContext,
): Promise<{ ok: true; items: StoreItem[] } | { ok: false; error: string }> {
  if (!shouldReadStoreItemOverlay(context)) {
    try {
      return { ok: true, items: listStoreItems(context.paths) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read store items.";
      return { ok: false, error: message };
    }
  }
  try {
    const baseline = readStoreCatalogSnapshot(context.paths);
    const blob = context.catalogBlob ?? netlifyStoreItemCatalogBlob();
    const overlay = await readOverlay(blob);
    if (!overlay.ok) return overlay;
    return { ok: true, items: listMergedStoreItems(baseline, overlay.overlay) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read store items.";
    return { ok: false, error: message };
  }
}

/**
 * Shop pages keep the deployed files if the saved catalog cannot be read,
 * so a blob problem does not take the public shop offline.
 */
export async function readStoreCatalogForShop(context: StoreItemRequestContext) {
  const baseline = readStoreCatalogSnapshot(context.paths);
  if (!shouldReadStoreItemOverlay(context)) return baseline;
  try {
    const blob = context.catalogBlob ?? netlifyStoreItemCatalogBlob();
    const overlay = await readOverlay(blob);
    if (!overlay.ok) return baseline;
    return mergeStoreCatalog(baseline, overlay.overlay);
  } catch {
    return baseline;
  }
}

export async function saveStoreItemForRequest(
  mode: "create" | "edit",
  input: StoreItemInput,
  context: StoreItemRequestContext,
): Promise<StoreItemSaveResult> {
  const access: StoreItemWriteAccess = resolveStoreItemWriteAccess(context);
  if (!access.ok) return { ok: false, error: access.error };
  if (access.mode === "filesystem") return saveStoreItem(mode, input, context.paths);

  try {
    const baseline = readStoreCatalogSnapshot(context.paths);
    const blob = context.catalogBlob ?? netlifyStoreItemCatalogBlob();
    const current = await readOverlay(blob);
    if (!current.ok) return current;
    const saved = saveStoreItemOnOverlay(baseline, current.overlay, mode, input);
    if (!saved.ok) return saved;
    if (!saved.overlay) return { ok: false, error: "Could not save the store item." };
    await blob.writeCatalog(saved.overlay);
    return { ok: true, item: saved.item };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the store item.";
    return { ok: false, error: message };
  }
}
