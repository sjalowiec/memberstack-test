/**
 * Knit it Now shop catalogs that do not already have an admin screen.
 *
 * Machines and accessories stay in the Machine Database and Machines for Sale.
 * Cables, downloads, DesignaKnit, and legacy eBooks stay in their current files.
 * Checkout still opens the existing Shopify product or Stripe Payment Link.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHARTING_RULERS_SLUG,
  CUT_N_SEW_SLUG,
  NEEDLE_SELECTION_SLUG,
  TECHNIQUE_CARDS_SLUG,
} from "../downloads/paidDownloadCatalog";
import {
  isLegacyEbookStorefrontEligible,
  parseLegacyEbooksActiveCsv,
  type LegacyEbooksActiveCsvRow,
} from "../legacy/legacyEbooksActive";
import { legacyEbookSlugFromTitle } from "../legacy/legacyEbookSlug";
import { EBOOK_SALES_PAUSED } from "../legacy/legacyEbookSalesHold";
import { legacyStoreThumbnailPath } from "../legacy/legacyEbookStorefrontUi";
import { slugify } from "../slugify";
import { serializeCsvRow, splitCsvRecords } from "./storeItemCsv";

export const STORE_ITEM_KINDS = ["cable", "download", "software", "ebook"] as const;
export type StoreItemKind = (typeof STORE_ITEM_KINDS)[number];

export const STORE_ITEM_KIND_LABELS: Record<StoreItemKind, string> = {
  cable: "Cable or accessory",
  download: "Download",
  software: "DesignaKnit",
  ebook: "eBook",
};

const LOCKED_DOWNLOAD_CHECKOUT = new Set([
  CHARTING_RULERS_SLUG,
  TECHNIQUE_CARDS_SLUG,
  CUT_N_SEW_SLUG,
  NEEDLE_SELECTION_SLUG,
]);

export type StoreItemCapabilities = {
  canEditTitle: boolean;
  canEditPrice: boolean;
  canEditCheckout: boolean;
  canEditVisibility: boolean;
  canEditSortOrder: boolean;
  canEditImage: boolean;
  canEditDetailImage: boolean;
  canEditDescriptionHtml: boolean;
  canEditVimeo: boolean;
  canEditIncludes: boolean;
  canEditSubscriberFree: boolean;
  canEditRecommended: boolean;
  canEditDownloadFile: boolean;
};

export type StoreItem = {
  key: string;
  kind: StoreItemKind;
  id: string;
  title: string;
  summary: string;
  description: string;
  descriptionFormat: "html" | "plain";
  imageUrl: string | null;
  imageFile: string | null;
  detailImageUrl: string | null;
  detailImageFile: string | null;
  visible: boolean | null;
  sortOrder: number | null;
  displayPrice: string;
  checkoutUrl: string;
  shopHref: string | null;
  downloadFile: string | null;
  subscriberFree: boolean | null;
  vimeoId: string | null;
  includesText: string;
  salesFocus: string;
  recommended: boolean | null;
  memberFree: boolean | null;
  slug: string | null;
  capabilities: StoreItemCapabilities;
  notes: string[];
};

export type StoreItemInput = {
  kind: StoreItemKind;
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  imageFile?: string | null;
  detailImageFile?: string | null;
  visible?: boolean | null;
  sortOrder?: number | null;
  displayPrice?: string;
  checkoutUrl?: string;
  downloadFile?: string | null;
  subscriberFree?: boolean | null;
  vimeoId?: string | null;
  includesText?: string;
  salesFocus?: string;
  recommended?: boolean | null;
};

export type StoreItemPaths = {
  cables: string;
  printables: string;
  software: string;
  ebooksCsv: string;
  ebookShopify: string;
};

export type StoreItemSaveResult =
  | { ok: true; item: StoreItem }
  | { ok: false; error: string };

const INVENTORY_NOTE = "This catalog does not track inventory.";
const PRICE_NOTE =
  "This is the price shown on Knit it Now. Shopify or Stripe charges the amount on the linked product. Saving here does not change that charge.";
const CHECKOUT_NOTE =
  "Paste the existing Shopify or Stripe link. This screen does not create a product or change how checkout works.";

export function defaultStoreItemPaths(): StoreItemPaths {
  return {
    cables: join(process.cwd(), "src", "data", "cables.json"),
    printables: join(process.cwd(), "src", "data", "printables.json"),
    software: join(process.cwd(), "src", "data", "designaknit-products.json"),
    ebooksCsv: join(process.cwd(), "src", "data", "legacy", "legacy-ebooks-active.csv"),
    ebookShopify: join(process.cwd(), "src", "data", "legacy", "legacy-ebook-shopify-urls.json"),
  };
}

export function isStoreItemKind(value: unknown): value is StoreItemKind {
  return typeof value === "string" && (STORE_ITEM_KINDS as readonly string[]).includes(value);
}

export function isAllowedStoreCheckoutUrl(kind: StoreItemKind, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (kind === "download") return url.hostname === "buy.stripe.com";
  return url.hostname === "buy.stripe.com" || url.hostname.endsWith(".myshopify.com");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function clean(value: unknown): string {
  return text(value).trim();
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readArray(filePath: string, label: string): Record<string, unknown>[] {
  const data = readJson(filePath);
  if (!Array.isArray(data)) throw new Error(`${label} must be a list.`);
  return data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
}

function flag(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === "string" && value.trim().toUpperCase() === "TRUE";
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return null;
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

function isSafeFilename(value: string): boolean {
  const name = value.trim();
  if (!name || name.toUpperCase() === "NULL") return false;
  if (name.includes("..") || /[\\/]/.test(name)) return false;
  return /^[^\\/:*?"<>|#]+$/.test(name);
}

function isSafeImageFilename(value: string): boolean {
  return isSafeFilename(value) && /\.(gif|jpe?g|png|webp)$/i.test(value.trim());
}

/** Uploaded shop images served from the hosted media route. */
export function isStoreItemMediaPath(value: string): boolean {
  return /^\/media\/store-items\/[a-z0-9][a-z0-9._-]{0,80}$/.test(value.trim());
}

function isSafeCatalogImageRef(value: string): boolean {
  return isSafeImageFilename(value) || isStoreItemMediaPath(value);
}

function isSafePublicImagePath(value: string): boolean {
  return value.startsWith("/images/") && !value.includes("..") && /^\/images\/[A-Za-z0-9._~/-]+$/.test(value);
}

function isSafeCatalogImagePath(value: string): boolean {
  return isSafePublicImagePath(value) || isStoreItemMediaPath(value);
}

function isSafeDownloadPath(value: string): boolean {
  return (
    value.startsWith("/downloads/") &&
    !value.includes("..") &&
    /^\/downloads\/[A-Za-z0-9._~/-]+$/.test(value)
  );
}

function includesToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => clean(item)).filter(Boolean).join("\n");
}

function textToIncludes(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function baseCapabilities(partial: Partial<StoreItemCapabilities>): StoreItemCapabilities {
  return {
    canEditTitle: true,
    canEditPrice: false,
    canEditCheckout: false,
    canEditVisibility: false,
    canEditSortOrder: false,
    canEditImage: false,
    canEditDetailImage: false,
    canEditDescriptionHtml: false,
    canEditVimeo: false,
    canEditIncludes: false,
    canEditSubscriberFree: false,
    canEditRecommended: false,
    canEditDownloadFile: false,
    ...partial,
  };
}

function itemKey(kind: StoreItemKind, id: string): string {
  return `${kind}:${id}`;
}

type EbookFile = {
  bom: boolean;
  newline: "\n" | "\r\n";
  header: string;
  rawRows: string[];
  rows: LegacyEbooksActiveCsvRow[];
};

function readEbookFile(filePath: string): EbookFile {
  const textBody = readFileSync(filePath, "utf8");
  const bom = textBody.charCodeAt(0) === 0xfeff;
  const body = bom ? textBody.slice(1) : textBody;
  const { newline, records } = splitCsvRecords(body);
  if (records.length < 2) throw new Error("The eBook catalog is missing its header or rows.");
  const parsed = parseLegacyEbooksActiveCsv(records.join("\n"));
  if (parsed.length !== records.length - 1) {
    throw new Error("The eBook catalog could not be read without changing its rows.");
  }
  return { bom, newline, header: records[0], rawRows: records.slice(1), rows: parsed };
}

function writeEbookFile(filePath: string, file: EbookFile): void {
  const body = [file.header, ...file.rawRows].join(file.newline) + file.newline;
  writeFileSync(filePath, `${file.bom ? "\uFEFF" : ""}${body}`, "utf8");
}

function readShopifyMap(filePath: string): Record<string, string> {
  const data = readJson(filePath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("eBook checkout links must be a list of item ids.");
  }
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.trim()) map[key] = value.trim();
  }
  return map;
}

function ebookNull(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : "NULL";
}

function ebookPresent(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return null;
  return trimmed;
}

function serializeEbookRow(row: LegacyEbooksActiveCsvRow): string {
  return serializeCsvRow([
    row.ItemId,
    row.ItemName,
    row.SellPrice,
    row.Thumbnail,
    row.DownloadFile,
    row.Breif,
    row.Description,
    row.Active,
    row.SubscriberFree,
  ]);
}

/** Keep each path segment intact, including spaces and brackets. */
function encodeCatalogImagePath(value: string): string {
  const hash = value.indexOf("#");
  const query = value.indexOf("?");
  let cut = value.length;
  if (hash >= 0) cut = Math.min(cut, hash);
  if (query >= 0) cut = Math.min(cut, query);
  const encoded = value
    .slice(0, cut)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${encoded}${value.slice(cut)}`;
}

export function cableImageUrl(filename: string | null): string | null {
  if (!filename) return null;
  const trimmed = filename.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/media/store-items/") || trimmed.startsWith("/images/")) {
    return encodeCatalogImagePath(trimmed);
  }
  return `/images/shop/designaknit/${encodeURIComponent(trimmed)}`;
}

function downloadVisibleNote(): string {
  return "Downloads do not have a hide switch. This version cannot remove an item from the shop.";
}

function mapCable(row: Record<string, unknown>, index: number): StoreItem {
  const id = clean(row.id);
  const thumbnail = clean(row.thumbnail);
  const visible = flag(row.active);
  return {
    key: itemKey("cable", id),
    kind: "cable",
    id,
    title: clean(row.name),
    summary: text(row.shortdescription),
    description: text(row.longDescription),
    descriptionFormat: "html",
    imageUrl: cableImageUrl(thumbnail || null),
    imageFile: thumbnail || null,
    detailImageUrl: null,
    detailImageFile: null,
    visible,
    sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index + 1,
    displayPrice: clean(row.price),
    checkoutUrl: clean(row.stripeLink),
    shopHref: id ? `/shop/cables/${id}` : null,
    downloadFile: null,
    subscriberFree: null,
    vimeoId: null,
    includesText: "",
    salesFocus: "",
    recommended: null,
    memberFree: null,
    slug: null,
    capabilities: baseCapabilities({
      canEditPrice: true,
      canEditCheckout: true,
      canEditVisibility: true,
      canEditSortOrder: true,
      canEditImage: true,
      canEditDescriptionHtml: true,
    }),
    notes: [
      INVENTORY_NOTE,
      PRICE_NOTE,
      CHECKOUT_NOTE,
      "Use this for a cable or another physical accessory, such as the DesignaKnit magnet. The shop address stays /shop/cables/….",
      "The short description is plain text on the cable list. Put links to videos or reference pages in the description.",
      "Hidden items stay in this list and are left off /shop/cables. View on shop previews a hidden item while you are signed in. Visitors do not see it.",
    ],
  };
}

function mapDownload(row: Record<string, unknown>, index: number): StoreItem {
  const slug = clean(row.slug);
  const image = clean(row.image);
  const productImage = row.productImage;
  const detail =
    productImage && typeof productImage === "object"
      ? clean((productImage as { value?: unknown }).value)
      : "";
  const media = row.media;
  const mediaType = media && typeof media === "object" ? clean((media as { type?: unknown }).type) : "";
  const mediaValue = media && typeof media === "object" ? clean((media as { value?: unknown }).value) : "";
  const checkoutLocked = LOCKED_DOWNLOAD_CHECKOUT.has(slug);
  return {
    key: itemKey("download", slug),
    kind: "download",
    id: slug,
    title: clean(row.title),
    summary: text(row.shortDescription),
    description: text(row.description),
    descriptionFormat: "html",
    imageUrl: image || null,
    imageFile: image || null,
    detailImageUrl: detail || null,
    detailImageFile: detail || null,
    visible: null,
    sortOrder: index + 1,
    displayPrice: clean(row.price),
    checkoutUrl: clean(row.stripeLink),
    shopHref: clean(row.detailsPage) || `/downloads/${slug}`,
    downloadFile: clean(row.file) || null,
    subscriberFree: null,
    vimeoId: mediaType === "vimeo" ? mediaValue || null : null,
    includesText: includesToText(row.includes),
    salesFocus: text(row.salesFocus),
    recommended: null,
    memberFree: row.memberFree === true,
    slug,
    capabilities: baseCapabilities({
      canEditCheckout: !checkoutLocked,
      canEditSortOrder: true,
      canEditImage: true,
      canEditDetailImage: true,
      canEditDescriptionHtml: true,
      canEditVimeo: true,
      canEditIncludes: true,
      canEditDownloadFile: true,
    }),
    notes: [
      INVENTORY_NOTE,
      downloadVisibleNote(),
      "The shop does not display a separate price. Stripe charges whatever the Payment Link charges.",
      checkoutLocked
        ? "This Payment Link stays locked because My Downloads matches the existing Stripe product."
        : "Paste an existing Stripe Payment Link (buy.stripe.com). Leave it blank to show the download without a Buy button.",
      "The short text and sales focus are plain text. Put links in the description.",
      row.memberFree === true
        ? "Members can download this without buying. That access rule is not changed here."
        : "This download is sold with its Stripe Payment Link. Member-free access is not changed here.",
    ],
  };
}

function mapSoftware(row: Record<string, unknown>): StoreItem {
  const id = clean(row.id);
  const visible = row.active !== false;
  return {
    key: itemKey("software", id),
    kind: "software",
    id,
    title: clean(row.title),
    summary: text(row.short),
    description: "",
    descriptionFormat: "plain",
    imageUrl: null,
    imageFile: null,
    detailImageUrl: null,
    detailImageFile: null,
    visible,
    sortOrder: null,
    displayPrice: clean(row.price),
    checkoutUrl: clean(row.href),
    shopHref: visible ? "/shop/designaknit" : null,
    downloadFile: null,
    subscriberFree: null,
    vimeoId: null,
    includesText: "",
    salesFocus: "",
    recommended: row.recommended === true,
    memberFree: null,
    slug: null,
    capabilities: baseCapabilities({
      canEditTitle: false,
      canEditPrice: true,
      canEditCheckout: true,
      canEditVisibility: true,
      canEditRecommended: true,
    }),
    notes: [
      INVENTORY_NOTE,
      PRICE_NOTE,
      CHECKOUT_NOTE,
      "The comparison chart matches these product names, so the name cannot be changed here.",
      "DesignaKnit stays in the comparison order built into the shop page. There is no separate image or long description in this catalog.",
      "Hidden versions are left off /shop/designaknit.",
    ],
  };
}

function ebookShopHrefs(rows: LegacyEbooksActiveCsvRow[]): Map<string, string> {
  const eligible = rows.filter(isLegacyEbookStorefrontEligible);
  const counts = new Map<string, number>();
  for (const row of eligible) {
    const base = slugify(row.ItemName);
    if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const hrefs = new Map<string, string>();
  for (const row of eligible) {
    hrefs.set(row.ItemId, `/shop/ebooks/${legacyEbookSlugFromTitle(row.ItemName, row.ItemId, counts)}`);
  }
  return hrefs;
}

function mapEbook(
  row: LegacyEbooksActiveCsvRow,
  shopify: Record<string, string>,
  hrefs: Map<string, string>,
): StoreItem {
  const thumbnail = ebookPresent(row.Thumbnail);
  const download = ebookPresent(row.DownloadFile);
  const visible = row.Active.trim() === "1";
  return {
    key: itemKey("ebook", row.ItemId),
    kind: "ebook",
    id: row.ItemId,
    title: row.ItemName.trim(),
    summary: row.Breif,
    description: row.Description,
    descriptionFormat: "html",
    imageUrl: thumbnail ? legacyStoreThumbnailPath(thumbnail) : null,
    imageFile: thumbnail,
    detailImageUrl: null,
    detailImageFile: null,
    visible,
    sortOrder: null,
    displayPrice: row.SellPrice.trim(),
    checkoutUrl: shopify[row.ItemId] ?? "",
    shopHref: hrefs.get(row.ItemId) ?? null,
    downloadFile: download,
    subscriberFree: row.SubscriberFree.trim() === "1",
    vimeoId: null,
    includesText: "",
    salesFocus: "",
    recommended: null,
    memberFree: null,
    slug: hrefs.get(row.ItemId)?.split("/").pop() ?? null,
    capabilities: baseCapabilities({
      canEditPrice: true,
      canEditCheckout: true,
      canEditVisibility: true,
      canEditImage: true,
      canEditDescriptionHtml: true,
      canEditSubscriberFree: true,
      canEditDownloadFile: true,
    }),
    notes: [
      INVENTORY_NOTE,
      PRICE_NOTE,
      CHECKOUT_NOTE,
      "The shop lists an eBook only when it is visible and has both a cover image and a download filename.",
      "The shop address is created from the title. Changing the title can change that address.",
      "Put links to videos or reference pages in the description. The shop keeps those links and removes scripts and embedded players.",
      "The short description is shown as plain text on the eBook list.",
      "Subscriber free does not turn on checkout or the Member Free badge. The badge is hidden until that membership flow is ready.",
      EBOOK_SALES_PAUSED
        ? "eBook sales are paused, so /shop/ebooks does not list titles until that pause is lifted."
        : "Visible eBooks appear on /shop/ebooks.",
      "eBooks are ordered by item number. This catalog does not have a separate display order.",
    ],
  };
}

export type StoreCatalogSnapshot = {
  cables: Record<string, unknown>[];
  downloads: Record<string, unknown>[];
  software: Record<string, unknown>[];
  ebooks: LegacyEbooksActiveCsvRow[];
  ebookShopify: Record<string, string>;
};

export function readStoreCatalogSnapshot(
  paths: StoreItemPaths = defaultStoreItemPaths(),
): StoreCatalogSnapshot {
  return {
    cables: readArray(paths.cables, "Cables"),
    downloads: readArray(paths.printables, "Downloads"),
    software: readArray(paths.software, "DesignaKnit"),
    ebooks: readEbookFile(paths.ebooksCsv).rows,
    ebookShopify: readShopifyMap(paths.ebookShopify),
  };
}

export function listStoreItemsFromSnapshot(snapshot: StoreCatalogSnapshot): StoreItem[] {
  const cables = snapshot.cables.map(mapCable);
  const downloads = snapshot.downloads.map(mapDownload);
  const software = snapshot.software
    .filter((row) => clean(row.category) === "DesignaKnit")
    .map(mapSoftware);
  const hrefs = ebookShopHrefs(snapshot.ebooks);
  const ebooks = snapshot.ebooks.map((row) => mapEbook(row, snapshot.ebookShopify, hrefs));
  return [...cables, ...downloads, ...software, ...ebooks];
}

export function listStoreItems(paths: StoreItemPaths = defaultStoreItemPaths()): StoreItem[] {
  return listStoreItemsFromSnapshot(readStoreCatalogSnapshot(paths));
}

function ebookFileFromRows(rows: LegacyEbooksActiveCsvRow[]): EbookFile {
  const cloned = rows.map((row) => ({ ...row }));
  return {
    bom: false,
    newline: "\n",
    header:
      "ItemId,ItemName,SellPrice,Thumbnail,DownloadFile,Breif,Description,Active,SubscriberFree",
    rawRows: cloned.map((row) => serializeEbookRow(row)),
    rows: cloned,
  };
}

export function applyStoreItemToSnapshot(
  snapshot: StoreCatalogSnapshot,
  mode: "create" | "edit",
  input: StoreItemInput,
): { ok: true; snapshot: StoreCatalogSnapshot; id: string } | { ok: false; error: string } {
  if (!isStoreItemKind(input.kind)) return { ok: false, error: "Choose a product type." };
  if (mode === "create" && input.kind === "software") {
    return { ok: false, error: "DesignaKnit versions are limited to the four comparison products." };
  }
  if (mode === "edit" && !clean(input.id)) return { ok: false, error: "Choose an item to edit." };
  if (text(input.description).length > 100000 || text(input.summary).length > 20000) {
    return { ok: false, error: "Description is too long to save." };
  }

  const next = structuredClone(snapshot);
  try {
    if (input.kind === "cable") {
      const applied = applyCable(next.cables, mode, input);
      if (!applied.ok) return applied;
      next.cables = applied.rows;
      return { ok: true, snapshot: next, id: applied.id };
    }
    if (input.kind === "download") {
      const applied = applyDownload(next.downloads, mode, input);
      if (!applied.ok) return applied;
      next.downloads = applied.rows;
      return { ok: true, snapshot: next, id: applied.id };
    }
    if (input.kind === "software") {
      const applied = applySoftware(next.software, input);
      if (!applied.ok) return applied;
      next.software = applied.rows;
      return { ok: true, snapshot: next, id: applied.id };
    }
    const file = ebookFileFromRows(next.ebooks);
    const shopify = { ...next.ebookShopify };
    const applied = applyEbook(file, shopify, mode, input);
    if (!applied.ok) return applied;
    next.ebooks = applied.file.rows;
    next.ebookShopify = applied.shopify;
    return { ok: true, snapshot: next, id: applied.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the store item.";
    return { ok: false, error: message };
  }
}

function requireTitle(value: string): string | null {
  if (!value.trim()) return "Enter a name.";
  if (value.trim().length > 200) return "Name must be 200 characters or less.";
  return null;
}

function optionalCheckout(kind: StoreItemKind, value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed && required) return "Enter the existing Shopify or Stripe link.";
  if (trimmed && !isAllowedStoreCheckoutUrl(kind, trimmed)) {
    return kind === "download"
      ? "Download checkout links must start with https://buy.stripe.com/."
      : "Checkout links must be an existing https:// Shopify or Stripe Payment Link.";
  }
  return null;
}

function nextNumericId(ids: number[]): number {
  const max = ids.reduce((highest, id) => Math.max(highest, id), 100);
  return max + 1;
}

function applyCable(
  rows: Record<string, unknown>[],
  mode: "create" | "edit",
  input: StoreItemInput,
): { ok: true; rows: Record<string, unknown>[]; id: string } | { ok: false; error: string } {
  const titleError = requireTitle(clean(input.title));
  if (titleError) return { ok: false, error: titleError };
  const price = parseMoney(clean(input.displayPrice));
  if (price === null) return { ok: false, error: "Enter the price shown on the shop, such as 24.95." };
  const checkoutError = optionalCheckout("cable", clean(input.checkoutUrl), false);
  if (checkoutError) return { ok: false, error: checkoutError };
  const image = clean(input.imageFile);
  if (!isSafeCatalogImageRef(image)) {
    return { ok: false, error: "Choose a cover image. JPG, PNG, WebP, or an existing GIF filename." };
  }
  const sortOrder = Number(input.sortOrder);
  if (!Number.isInteger(sortOrder)) return { ok: false, error: "Display order must be a whole number." };
  const visible = input.visible === false ? false : true;

  if (mode === "create") {
    const id = nextNumericId(rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id)));
    rows.push({
      id,
      name: clean(input.title),
      price,
      stripeLink: clean(input.checkoutUrl),
      thumbnail: image,
      shortdescription: text(input.summary).trim(),
      longDescription: text(input.description),
      active: visible ? "TRUE" : "FALSE",
      sortOrder,
    });
    return { ok: true, rows, id: String(id) };
  }

  const index = rows.findIndex((row) => clean(row.id) === clean(input.id));
  if (index < 0) return { ok: false, error: "That cable could not be found." };
  const current = rows[index];
  const activeValue = typeof current.active === "string" ? (visible ? "TRUE" : "FALSE") : visible;
  rows[index] = {
    ...current,
    name: clean(input.title),
    price,
    stripeLink: clean(input.checkoutUrl),
    thumbnail: image,
    shortdescription: text(input.summary).trim(),
    longDescription: text(input.description),
    active: activeValue,
    sortOrder,
  };
  return { ok: true, rows, id: clean(input.id) };
}

function applyDownload(
  rows: Record<string, unknown>[],
  mode: "create" | "edit",
  input: StoreItemInput,
): { ok: true; rows: Record<string, unknown>[]; id: string } | { ok: false; error: string } {
  const titleError = requireTitle(clean(input.title));
  if (titleError) return { ok: false, error: titleError };
  const image = clean(input.imageFile);
  if (!isSafeCatalogImagePath(image)) {
    return { ok: false, error: "Choose a shop image under /images/ or upload one." };
  }
  const detail = clean(input.detailImageFile);
  if (detail && !isSafeCatalogImagePath(detail)) {
    return { ok: false, error: "The detail image must stay under /images/ or be an uploaded shop image." };
  }
  const file = clean(input.downloadFile);
  if (!isSafeDownloadPath(file)) {
    return { ok: false, error: "Enter the public PDF path, starting with /downloads/." };
  }
  const checkout = clean(input.checkoutUrl);
  const vimeo = clean(input.vimeoId);
  if (vimeo && !/^\d{5,20}$/.test(vimeo)) {
    return { ok: false, error: "Vimeo id must be the number from the video URL." };
  }
  const sortOrder = Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    return { ok: false, error: "Display order must be 1 or higher." };
  }

  const buildMedia = (current: Record<string, unknown> | null): { type: "vimeo" | "image"; value: string } => {
    if (vimeo) return { type: "vimeo", value: vimeo };
    const currentMedia = current?.media;
    const currentType =
      currentMedia && typeof currentMedia === "object" ? clean((currentMedia as { type?: unknown }).type) : "";
    const currentValue =
      currentMedia && typeof currentMedia === "object" ? clean((currentMedia as { value?: unknown }).value) : "";
    if (currentType === "image" && currentValue) return { type: "image", value: currentValue };
    return { type: "image", value: detail || image };
  };

  if (mode === "create") {
    const slug = slugify(clean(input.title));
    if (!slug) return { ok: false, error: "Enter a name that can be used in the shop address." };
    if (rows.some((row) => clean(row.slug) === slug)) {
      return { ok: false, error: "An item already uses that shop address. Change the name slightly." };
    }
    const checkoutError = optionalCheckout("download", checkout, false);
    if (checkoutError) return { ok: false, error: checkoutError };
    rows.push({
      slug,
      title: clean(input.title),
      shortDescription: text(input.summary).trim(),
      description: text(input.description),
      salesFocus: text(input.salesFocus).trim(),
      stripeLink: checkout,
      file,
      price: 0,
      memberFree: false,
      image,
      productImage: { type: "image", value: detail || image },
      media: buildMedia(null),
      detailsPage: `/downloads/${slug}`,
      includes: textToIncludes(text(input.includesText)),
    });
    moveRow(rows, rows.length - 1, sortOrder);
    return { ok: true, rows, id: slug };
  }

  const index = rows.findIndex((row) => clean(row.slug) === clean(input.id));
  if (index < 0) return { ok: false, error: "That download could not be found." };
  const current = rows[index];
  const slug = clean(current.slug);
  const checkoutError = optionalCheckout("download", checkout, false);
  if (checkoutError) return { ok: false, error: checkoutError };
  if (LOCKED_DOWNLOAD_CHECKOUT.has(slug) && checkout !== clean(current.stripeLink)) {
    return { ok: false, error: "This Payment Link stays locked because My Downloads matches the existing Stripe product." };
  }
  rows[index] = {
    ...current,
    title: clean(input.title),
    shortDescription: text(input.summary).trim(),
    description: text(input.description),
    salesFocus: text(input.salesFocus).trim(),
    stripeLink: LOCKED_DOWNLOAD_CHECKOUT.has(slug) ? current.stripeLink : checkout,
    file,
    image,
    productImage: { type: "image", value: detail || image },
    media: buildMedia(current),
    includes: textToIncludes(text(input.includesText)),
  };
  moveRow(rows, index, sortOrder);
  return { ok: true, rows, id: slug };
}

function moveRow(rows: Record<string, unknown>[], from: number, displayOrder: number): void {
  const [row] = rows.splice(from, 1);
  const target = Math.min(Math.max(displayOrder, 1), rows.length + 1) - 1;
  rows.splice(target, 0, row);
}

function applySoftware(
  rows: Record<string, unknown>[],
  input: StoreItemInput,
): { ok: true; rows: Record<string, unknown>[]; id: string } | { ok: false; error: string } {
  const index = rows.findIndex((row) => clean(row.id) === clean(input.id) && clean(row.category) === "DesignaKnit");
  if (index < 0) return { ok: false, error: "That DesignaKnit version could not be found." };
  const current = rows[index];
  if (clean(input.title) !== clean(current.title)) {
    return { ok: false, error: "The comparison chart uses this product name, so it cannot be changed here." };
  }
  const price = clean(input.displayPrice);
  if (!price || price.length > 40) return { ok: false, error: "Enter the price shown on the shop, such as $199." };
  const checkoutError = optionalCheckout("software", clean(input.checkoutUrl), true);
  if (checkoutError) return { ok: false, error: checkoutError };
  rows[index] = {
    ...current,
    short: text(input.summary).trim(),
    price,
    href: clean(input.checkoutUrl),
    active: input.visible !== false,
    recommended: input.recommended === true,
  };
  return { ok: true, rows, id: clean(current.id) };
}

function applyEbook(
  file: EbookFile,
  shopify: Record<string, string>,
  mode: "create" | "edit",
  input: StoreItemInput,
): { ok: true; file: EbookFile; shopify: Record<string, string>; id: string } | { ok: false; error: string } {
  const titleError = requireTitle(clean(input.title));
  if (titleError) return { ok: false, error: titleError };
  const price = parseMoney(clean(input.displayPrice));
  if (price === null) return { ok: false, error: "Enter the price shown on the shop, such as 14.95." };
  const sellPrice = formatMoney(price);
  const checkoutError = optionalCheckout("ebook", clean(input.checkoutUrl), false);
  if (checkoutError) return { ok: false, error: checkoutError };
  const image = clean(input.imageFile);
  const download = clean(input.downloadFile);
  const visible = input.visible === false ? false : true;
  if (image && !isSafeCatalogImageRef(image)) {
    return { ok: false, error: "Cover image must be a file name such as cover.jpg, not a web address." };
  }
  if (download && !isSafeFilename(download)) {
    return { ok: false, error: "Download filename must be the file name only, such as book.pdf." };
  }
  if (visible && (!image || !download)) {
    return {
      ok: false,
      error: "A visible eBook needs both a cover image and a download filename. Hide it if those are not ready.",
    };
  }

  const writeRow = (id: string, current: LegacyEbooksActiveCsvRow | null): LegacyEbooksActiveCsvRow => ({
    ItemId: id,
    ItemName: clean(input.title),
    SellPrice: sellPrice,
    Thumbnail: ebookNull(image),
    DownloadFile: ebookNull(download),
    Breif: text(input.summary),
    Description: text(input.description),
    Active: visible ? "1" : "0",
    SubscriberFree:
      input.subscriberFree === true
        ? "1"
        : input.subscriberFree === false
          ? "0"
          : current?.SubscriberFree.trim() === "1"
            ? "1"
            : "0",
  });

  if (mode === "create") {
    const id = String(nextNumericId(file.rows.map((row) => Number(row.ItemId)).filter((id) => Number.isInteger(id))));
    const row = writeRow(id, null);
    file.rows.push(row);
    file.rawRows.push(serializeEbookRow(row));
    if (clean(input.checkoutUrl)) shopify[id] = clean(input.checkoutUrl);
    return { ok: true, file, shopify, id };
  }

  const index = file.rows.findIndex((row) => row.ItemId === clean(input.id));
  if (index < 0) return { ok: false, error: "That eBook could not be found." };
  const id = file.rows[index].ItemId;
  const row = writeRow(id, file.rows[index]);
  file.rows[index] = row;
  file.rawRows[index] = serializeEbookRow(row);
  const checkout = clean(input.checkoutUrl);
  if (checkout) shopify[id] = checkout;
  else delete shopify[id];
  return { ok: true, file, shopify, id };
}

export function saveStoreItem(
  mode: "create" | "edit",
  input: StoreItemInput,
  paths: StoreItemPaths = defaultStoreItemPaths(),
): StoreItemSaveResult {
  if (!isStoreItemKind(input.kind)) return { ok: false, error: "Choose a product type." };
  if (mode === "create" && input.kind === "software") {
    return { ok: false, error: "DesignaKnit versions are limited to the four comparison products." };
  }
  if (mode === "edit" && !clean(input.id)) return { ok: false, error: "Choose an item to edit." };
  if (text(input.description).length > 100000 || text(input.summary).length > 20000) {
    return { ok: false, error: "Description is too long to save." };
  }

  try {
    if (input.kind === "cable") {
      const rows = readArray(paths.cables, "Cables");
      const applied = applyCable(rows, mode, input);
      if (!applied.ok) return applied;
      writeJson(paths.cables, applied.rows);
      return found(applied.id, "cable", paths);
    }
    if (input.kind === "download") {
      const rows = readArray(paths.printables, "Downloads");
      const applied = applyDownload(rows, mode, input);
      if (!applied.ok) return applied;
      writeJson(paths.printables, applied.rows);
      return found(applied.id, "download", paths);
    }
    if (input.kind === "software") {
      const rows = readArray(paths.software, "DesignaKnit");
      const applied = applySoftware(rows, input);
      if (!applied.ok) return applied;
      writeJson(paths.software, applied.rows);
      return found(applied.id, "software", paths);
    }
    const file = readEbookFile(paths.ebooksCsv);
    const originalShopify = readShopifyMap(paths.ebookShopify);
    const shopify = { ...originalShopify };
    const applied = applyEbook(file, shopify, mode, input);
    if (!applied.ok) return applied;
    writeEbookFile(paths.ebooksCsv, applied.file);
    if (JSON.stringify(applied.shopify) !== JSON.stringify(originalShopify)) {
      writeJson(paths.ebookShopify, applied.shopify);
    }
    return found(applied.id, "ebook", paths);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the store item.";
    return { ok: false, error: message };
  }
}

function found(id: string, kind: StoreItemKind, paths: StoreItemPaths): StoreItemSaveResult {
  const item = listStoreItems(paths).find((row) => row.kind === kind && row.id === id);
  if (!item) return { ok: false, error: "The item saved, but it could not be read back." };
  return { ok: true, item };
}
