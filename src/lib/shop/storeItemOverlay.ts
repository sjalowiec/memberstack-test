/**
 * Saved Store Items sit on top of the catalog files shipped with a deploy.
 * A saved id replaces that id. A new id is added once. Untouched items keep
 * coming from the deployed files, including after a later code deploy.
 */
import type { LegacyEbooksActiveCsvRow } from "../legacy/legacyEbooksActive";
import {
  applyStoreItemToSnapshot,
  listStoreItemsFromSnapshot,
  type StoreCatalogSnapshot,
  type StoreItem,
  type StoreItemInput,
  type StoreItemKind,
  type StoreItemSaveResult,
} from "./storeItemCatalog";

export type StoreItemOverlay = {
  version: 1;
  cables: Record<string, Record<string, unknown>>;
  downloads: Record<string, Record<string, unknown>>;
  downloadOrder: string[] | null;
  software: Record<string, Record<string, unknown>>;
  ebooks: Record<string, LegacyEbooksActiveCsvRow>;
  ebookShopify: Record<string, string | null>;
};

export function emptyStoreItemOverlay(): StoreItemOverlay {
  return {
    version: 1,
    cables: {},
    downloads: {},
    downloadOrder: null,
    software: {},
    ebooks: {},
    ebookShopify: {},
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function recordMap(value: unknown): Record<string, Record<string, unknown>> | null {
  if (!isRecord(value)) return null;
  const map: Record<string, Record<string, unknown>> = {};
  for (const [key, row] of Object.entries(value)) {
    const id = clean(key);
    if (!id || !isRecord(row)) return null;
    map[id] = row;
  }
  return map;
}

function isEbookRow(value: unknown): value is LegacyEbooksActiveCsvRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.ItemId === "string" &&
    typeof value.ItemName === "string" &&
    typeof value.SellPrice === "string" &&
    typeof value.Thumbnail === "string" &&
    typeof value.DownloadFile === "string" &&
    typeof value.Breif === "string" &&
    typeof value.Description === "string" &&
    typeof value.Active === "string" &&
    typeof value.SubscriberFree === "string"
  );
}

export function parseStoreItemOverlay(value: unknown): StoreItemOverlay | null {
  if (value == null) return emptyStoreItemOverlay();
  if (!isRecord(value) || value.version !== 1) return null;
  const cables = recordMap(value.cables);
  const downloads = recordMap(value.downloads);
  const software = recordMap(value.software);
  if (!cables || !downloads || !software) return null;
  if (value.downloadOrder != null && !Array.isArray(value.downloadOrder)) return null;
  const downloadOrder = Array.isArray(value.downloadOrder)
    ? value.downloadOrder.map((entry) => clean(entry)).filter(Boolean)
    : null;
  if (!isRecord(value.ebooks) || !isRecord(value.ebookShopify)) return null;
  const ebooks: Record<string, LegacyEbooksActiveCsvRow> = {};
  for (const [key, row] of Object.entries(value.ebooks)) {
    const id = clean(key);
    if (!id || !isEbookRow(row) || clean(row.ItemId) !== id) return null;
    ebooks[id] = row;
  }
  const ebookShopify: Record<string, string | null> = {};
  for (const [key, url] of Object.entries(value.ebookShopify)) {
    const id = clean(key);
    if (!id) return null;
    if (url == null) ebookShopify[id] = null;
    else if (typeof url === "string") ebookShopify[id] = url.trim();
    else return null;
  }
  return { version: 1, cables, downloads, software, downloadOrder, ebooks, ebookShopify };
}

function mergeById(
  rows: Record<string, unknown>[],
  overrides: Record<string, Record<string, unknown>>,
  idOf: (row: Record<string, unknown>) => string,
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const merged = rows.map((row) => {
    const id = idOf(row);
    if (!id) return row;
    seen.add(id);
    return overrides[id] ? { ...overrides[id] } : row;
  });
  for (const [id, row] of Object.entries(overrides)) {
    if (!seen.has(id)) merged.push({ ...row });
  }
  return merged;
}

function downloadSlug(row: Record<string, unknown>): string {
  return clean(row.slug);
}

function applyDownloadOrder(
  rows: Record<string, unknown>[],
  order: string[] | null,
): Record<string, unknown>[] {
  if (!order || order.length === 0) return rows;
  const bySlug = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const slug = downloadSlug(row);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, row);
  }
  const used = new Set<string>();
  const ordered: Record<string, unknown>[] = [];
  for (const slug of order) {
    const row = bySlug.get(slug);
    if (!row || used.has(slug)) continue;
    ordered.push(row);
    used.add(slug);
  }
  for (const row of rows) {
    const slug = downloadSlug(row);
    if (!slug || used.has(slug)) continue;
    ordered.push(row);
    used.add(slug);
  }
  return ordered;
}

export function mergeStoreCatalog(
  baseline: StoreCatalogSnapshot,
  overlay: StoreItemOverlay | null,
): StoreCatalogSnapshot {
  const saved = overlay ?? emptyStoreItemOverlay();
  const downloads = applyDownloadOrder(
    mergeById(baseline.downloads, saved.downloads, downloadSlug),
    saved.downloadOrder,
  );
  const software = baseline.software.map((row) => {
    const id = clean(row.id);
    return id && saved.software[id] ? { ...saved.software[id] } : row;
  });
  const seenEbooks = new Set<string>();
  const ebooks = baseline.ebooks.map((row) => {
    const id = clean(row.ItemId);
    seenEbooks.add(id);
    return saved.ebooks[id] ? { ...saved.ebooks[id] } : row;
  });
  for (const [id, row] of Object.entries(saved.ebooks)) {
    if (!seenEbooks.has(id)) ebooks.push({ ...row });
  }
  const ebookShopify = { ...baseline.ebookShopify };
  for (const [id, url] of Object.entries(saved.ebookShopify)) {
    if (!url) delete ebookShopify[id];
    else ebookShopify[id] = url;
  }
  return {
    cables: mergeById(baseline.cables, saved.cables, (row) => clean(row.id)),
    downloads,
    software,
    ebooks,
    ebookShopify,
  };
}

function slugOrder(rows: Record<string, unknown>[]): string[] {
  return rows.map((row) => downloadSlug(row)).filter(Boolean);
}

/** Remember only the item that was saved, so untouched catalog files still apply. */
export function overlayAfterSave(
  before: StoreCatalogSnapshot,
  after: StoreCatalogSnapshot,
  overlay: StoreItemOverlay,
  kind: StoreItemKind,
  id: string,
): StoreItemOverlay {
  const next: StoreItemOverlay = {
    version: 1,
    cables: { ...overlay.cables },
    downloads: { ...overlay.downloads },
    downloadOrder: overlay.downloadOrder,
    software: { ...overlay.software },
    ebooks: { ...overlay.ebooks },
    ebookShopify: { ...overlay.ebookShopify },
  };
  if (kind === "cable") {
    const row = after.cables.find((entry) => clean(entry.id) === id);
    if (row) next.cables[id] = row;
  } else if (kind === "download") {
    const row = after.downloads.find((entry) => downloadSlug(entry) === id);
    if (row) next.downloads[id] = row;
    const beforeOrder = slugOrder(before.downloads);
    const afterOrder = slugOrder(after.downloads);
    if (beforeOrder.join("\n") !== afterOrder.join("\n")) next.downloadOrder = afterOrder;
  } else if (kind === "software") {
    const row = after.software.find((entry) => clean(entry.id) === id);
    if (row) next.software[id] = row;
  } else if (kind === "ebook") {
    const row = after.ebooks.find((entry) => clean(entry.ItemId) === id);
    if (row) next.ebooks[id] = { ...row };
    const url = clean(after.ebookShopify[id]);
    next.ebookShopify[id] = url || null;
  }
  return next;
}

export function saveStoreItemOnOverlay(
  baseline: StoreCatalogSnapshot,
  overlay: StoreItemOverlay,
  mode: "create" | "edit",
  input: StoreItemInput,
): StoreItemSaveResult & { overlay?: StoreItemOverlay } {
  const before = mergeStoreCatalog(baseline, overlay);
  const applied = applyStoreItemToSnapshot(before, mode, input);
  if (!applied.ok) return applied;
  const nextOverlay = overlayAfterSave(before, applied.snapshot, overlay, input.kind, applied.id);
  const item = listStoreItemsFromSnapshot(applied.snapshot).find(
    (row) => row.kind === input.kind && row.id === applied.id,
  );
  if (!item) return { ok: false, error: "The item saved, but it could not be read back." };
  return { ok: true, item, overlay: nextOverlay };
}

export function listMergedStoreItems(
  baseline: StoreCatalogSnapshot,
  overlay: StoreItemOverlay | null,
): StoreItem[] {
  return listStoreItemsFromSnapshot(mergeStoreCatalog(baseline, overlay));
}
