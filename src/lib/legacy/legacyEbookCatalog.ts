import { readFileSync } from "node:fs";
import { join } from "node:path";
import shopDownloadsManifest from "../../data/generated/shop-downloads-manifest.json";

export const LEGACY_EBOOK_CATALOG_CSV_PATH = join(
  process.cwd(),
  "src",
  "data",
  "legacy",
  "legacy-ebook-catalog.csv"
);

export type LegacyEbookCatalogRow = {
  legacyId: string;
  title: string;
  downloadFile: string | null;
  active: boolean | null;
};

export type LegacyFileStatus = "found" | "missing" | "no-filename";

export type LegacyEbookCatalogRowAudited = LegacyEbookCatalogRow & {
  fileStatus: LegacyFileStatus;
  /** Actual filename on disk when matched (may differ in case). */
  matchedShopFile: string | null;
};

export const LEGACY_SHOP_DOWNLOADS_PUBLIC_PREFIX = "/downloads/shop";

function normalizeField(value: string): string | null {
  const v = value.trim();
  if (!v || v.toUpperCase() === "NULL") return null;
  return v;
}

function parseActive(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

/** Load legacy store catalog rows from the SQL export CSV. */
export function loadLegacyEbookCatalog(): LegacyEbookCatalogRow[] {
  const raw = readFileSync(LEGACY_EBOOK_CATALOG_CSV_PATH, "utf-8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const [, ...dataLines] = lines;

  const rows = dataLines.map((line) => {
    const cols = line.split(",");
    return {
      legacyId: cols[0]?.trim() ?? "",
      title: cols[1]?.trim() ?? "",
      downloadFile: normalizeField(cols[3] ?? ""),
      active: parseActive(normalizeField(cols[6] ?? "")),
    } satisfies LegacyEbookCatalogRow;
  });

  return rows.sort((a, b) => {
    const ai = parseInt(a.legacyId, 10);
    const bi = parseInt(b.legacyId, 10);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a.legacyId.localeCompare(b.legacyId);
  });
}

export function formatLegacyCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

export function formatActiveLabel(active: boolean | null): string {
  if (active === null) return "—";
  return active ? "Active" : "Inactive";
}

/**
 * Snapshot of public/downloads/shop (filename + byte size) captured at build
 * time by scripts/generate-public-manifests.mjs. Reading this manifest instead
 * of scanning the directory keeps the Netlify SSR function from bundling the
 * whole public/downloads tree (see that script's header for the rationale).
 */
type ShopDownloadManifestEntry = { name: string; size: number | null };

const SHOP_DOWNLOADS: ShopDownloadManifestEntry[] =
  shopDownloadsManifest as ShopDownloadManifestEntry[];

const SHOP_FILE_SIZES: ReadonlyMap<string, number | null> = new Map(
  SHOP_DOWNLOADS.map((entry) => [entry.name, entry.size])
);

/** List filenames in public/downloads/shop (empty if none). */
export function listLegacyShopDownloadFiles(): string[] {
  return SHOP_DOWNLOADS.map((entry) => entry.name);
}

/** Case-insensitive lookup: lowercase name → canonical on-disk filename. */
export function buildLegacyShopFileIndex(
  files: string[] = listLegacyShopDownloadFiles()
): Map<string, string> {
  const index = new Map<string, string>();
  for (const name of files) {
    index.set(name.toLowerCase(), name);
  }
  return index;
}

export function auditLegacyEbookFileStatus(
  book: LegacyEbookCatalogRow,
  shopIndex: Map<string, string>
): Pick<LegacyEbookCatalogRowAudited, "fileStatus" | "matchedShopFile"> {
  if (!book.downloadFile) {
    return { fileStatus: "no-filename", matchedShopFile: null };
  }

  const legacyName = book.downloadFile.toLowerCase();
  const exact = shopIndex.get(legacyName);
  if (exact) {
    return { fileStatus: "found", matchedShopFile: exact };
  }

  const idPrefix = `${book.legacyId}_${book.downloadFile}`.toLowerCase();
  const prefixed = shopIndex.get(idPrefix);
  if (prefixed) {
    return { fileStatus: "found", matchedShopFile: prefixed };
  }

  const suffix = `_${legacyName}`;
  for (const [key, canonical] of shopIndex) {
    if (key.endsWith(suffix)) {
      return { fileStatus: "found", matchedShopFile: canonical };
    }
  }

  return { fileStatus: "missing", matchedShopFile: null };
}

export function auditLegacyEbookCatalog(
  books: LegacyEbookCatalogRow[] = loadLegacyEbookCatalog(),
  shopIndex: Map<string, string> = buildLegacyShopFileIndex()
): LegacyEbookCatalogRowAudited[] {
  return books.map((book) => ({
    ...book,
    ...auditLegacyEbookFileStatus(book, shopIndex),
  }));
}

export function formatFileStatusLabel(status: LegacyFileStatus): string {
  switch (status) {
    case "found":
      return "File found";
    case "missing":
      return "Missing file";
    case "no-filename":
      return "No filename";
  }
}

/** Sort key for File Status column (ascending: no filename → missing → found). */
export function fileStatusSortKey(status: LegacyFileStatus): number {
  switch (status) {
    case "no-filename":
      return 0;
    case "missing":
      return 1;
    case "found":
      return 2;
  }
}

export type LegacyShopFileEntry = {
  filename: string;
  extension: string;
  fileType: string;
  sizeKb: number | null;
  /** Leading numeric legacy ID when filename is like `417_title.pdf`. */
  legacyIdPrefix: string | null;
};

const SHOP_AUDIT_EXTENSIONS = new Set([".pdf", ".zip"]);

export function getShopFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "";
  return filename.slice(dot).toLowerCase();
}

export function formatShopFileType(extension: string): string {
  if (!extension) return "—";
  return extension.slice(1).toUpperCase();
}

export function parseShopFilenameLegacyIdPrefix(filename: string): string | null {
  const match = /^(\d+)_/.exec(filename);
  return match?.[1] ?? null;
}

function statShopFileSizeKb(filename: string): number | null {
  const bytes = SHOP_FILE_SIZES.get(filename);
  if (bytes == null) return null;
  return Math.round((bytes / 1024) * 10) / 10;
}

function isShopAuditFile(filename: string): boolean {
  return SHOP_AUDIT_EXTENSIONS.has(getShopFileExtension(filename));
}

/** Shop files (PDF/ZIP) not linked to any catalog row by the audit matcher. */
export function listUnmatchedLegacyShopFiles(
  audited: LegacyEbookCatalogRowAudited[],
  shopFiles: string[] = listLegacyShopDownloadFiles()
): LegacyShopFileEntry[] {
  const matched = new Set<string>();
  for (const book of audited) {
    if (book.matchedShopFile) {
      matched.add(book.matchedShopFile.toLowerCase());
    }
  }

  return shopFiles
    .filter((name) => isShopAuditFile(name) && !matched.has(name.toLowerCase()))
    .map((filename) => {
      const extension = getShopFileExtension(filename);
      return {
        filename,
        extension,
        fileType: formatShopFileType(extension),
        sizeKb: statShopFileSizeKb(filename),
        legacyIdPrefix: parseShopFilenameLegacyIdPrefix(filename),
      };
    })
    .sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" })
    );
}

export function formatShopFileSizeKb(sizeKb: number | null): string {
  if (sizeKb === null) return "—";
  return `${sizeKb.toLocaleString()} KB`;
}

/** Public site path for a matched shop download (basename only, URL-encoded). */
export function getLegacyShopDownloadPublicUrl(
  matchedShopFile: string | null | undefined
): string | null {
  if (!matchedShopFile?.trim()) return null;
  const basename = matchedShopFile.trim().replace(/^.*[/\\]/, "");
  if (!basename || basename.includes("..")) return null;
  return `${LEGACY_SHOP_DOWNLOADS_PUBLIC_PREFIX}/${encodeURIComponent(basename)}`;
}

export function getLegacyShopDownloadHref(
  book: Pick<LegacyEbookCatalogRowAudited, "fileStatus" | "matchedShopFile">
): string | null {
  if (book.fileStatus !== "found") return null;
  return getLegacyShopDownloadPublicUrl(book.matchedShopFile);
}

