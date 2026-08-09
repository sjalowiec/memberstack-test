/**
 * Canonical approved legacy ebook entitlements for My Downloads (previous purchases).
 *
 * Each approved entry includes a public static download URL under /downloads/shop/.
 * Ownership is still gated by Memberstack login + purchase email match; static files
 * themselves are intentionally unprotected (accepted tradeoff).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export const LEGACY_EBOOK_EXCLUSION_REASON =
  "Legacy title unavailable for redistribution";

/** Explicitly excluded legacy store item IDs (never appear in My Downloads). */
export const LEGACY_EBOOK_EXCLUDED_ITEM_IDS = new Set<string>([
  "434", // Knit It Now Croquis Family
  "441", // Tam and Scarf with G-Carriage
  "444", // Traditional Irish Cardigans
  "446", // Traditional Irish Knits Pullovers
  "448", // Supplement to Irish Knits Cardigans
  "457", // Traditional Irish Cardigans alternate
  "458", // Supplement alternate
  "506", // Tuck Lace Stitch Pattern Template (no deliverable)
  "520", // Mitten Magic
  "528", // Top Down for Toddlers
  "621", // Passap E-6000 Guidebook
  "777", // Universal Link for DesignaKnit (hardware)
]);

/**
 * Build a public site path under /downloads/shop with per-segment URL encoding
 * (handles spaces and special characters in filenames).
 */
export function legacyEbookPublicDownloadUrl(
  ...pathSegmentsRelativeToShop: string[]
): string {
  const encoded = pathSegmentsRelativeToShop
    .map((segment) => encodeURIComponent(segment.trim()))
    .filter(Boolean);
  return `/downloads/shop/${encoded.join("/")}`;
}

/** Resolve a public /downloads/shop/... URL to an absolute filesystem path under public/. */
export function legacyEbookPublicUrlToFilesystemPath(
  downloadUrl: string,
  projectRoot: string = process.cwd(),
): string | null {
  const trimmed = downloadUrl.trim();
  const prefix = "/downloads/shop/";
  if (!trimmed.startsWith(prefix)) return null;

  const relativeEncoded = trimmed.slice(prefix.length);
  if (!relativeEncoded || relativeEncoded.includes("..")) return null;

  const segments = relativeEncoded.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });

  if (segments.some((s) => s === ".." || s.includes("\0"))) return null;

  return join(projectRoot, "public", "downloads", "shop", ...segments);
}

export function legacyEbookPublicFileExists(
  downloadUrl: string,
  projectRoot: string = process.cwd(),
): boolean {
  const fsPath = legacyEbookPublicUrlToFilesystemPath(downloadUrl, projectRoot);
  return Boolean(fsPath && existsSync(fsPath));
}

export type LegacyEbookEntitlementEntry = {
  itemId: string;
  /** Customer-facing title shown in My Downloads. */
  title: string;
  /** Canonical filename / storage key (basename). */
  storageKey: string;
  /** Public static download URL (URL-encoded path under /downloads/shop/). */
  downloadUrl: string;
  /** Legacy catalog Active flag (retired titles remain downloadable when approved). */
  active: boolean;
  approved: true;
};

/** Customer-safe entitlement row (no filesystem paths or purchase PII). */
export type LegacyEbookCustomerEntitlement = {
  itemId: string;
  title: string;
  downloadUrl: string;
};

/**
 * Approved legacy ebook catalog (47 titles).
 * Special remaps: 346 → recovered Swan/Ultimate Socks under shop/legacy/;
 * 536/620/437/443 → recovered files under shop/legacy/. Item 710 stays on the
 * current electronic edition in the shop root.
 */
export const LEGACY_EBOOK_ENTITLEMENT_CATALOG: readonly LegacyEbookEntitlementEntry[] =
  [
    {
      itemId: "346",
      title: "The ULTIMATE Machine Knit Socks",
      storageKey: "ultimate_socks.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "ultimate_socks.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "416",
      title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
      storageKey: "cheet_sheet_book2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("cheet_sheet_book2.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "417",
      title: "After Five Easy Elegance (Dresses)",
      storageKey: "417_easy_elegance2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("417_easy_elegance2.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "418",
      title: "A Shirt for All Seasons",
      storageKey: "418_shirts_new3.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("418_shirts_new3.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "419",
      title: "Let's Knit Some Slacks",
      storageKey: "419_slacks2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("419_slacks2.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "421",
      title: "Crochet Trims for Knits",
      storageKey: "421_Crochet_trims2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("421_Crochet_trims2.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "422",
      title: "Signature Hats and Caps",
      storageKey: "422_Signature_Hats.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("422_Signature_Hats.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "425",
      title: "Top Down Raglan - Standard - Round Neck - for Everyone",
      storageKey: "top_down_round_everyone.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "top-down",
        "top_down_round_everyone.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "427",
      title: "Let's Knit Some Skirts",
      storageKey: "427_skirts.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("427_skirts.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "428",
      title: "Jodi's Favorite Demos Volume 1",
      storageKey: "428_jodi_demo_one_update.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("428_jodi_demo_one_update.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "429",
      title: "Jodi's Favorite Demos Volume 2",
      storageKey: "429_Jodie_demo2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("429_Jodie_demo2.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "430",
      title: "Let's Knit Some Blouses",
      storageKey: "430_blouses1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("430_blouses1.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "432",
      title: "Let's Knit Some Jackets",
      storageKey: "432_jackets11.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("432_jackets11.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "437",
      title: "Hearts and Flowers for Baby Blankets",
      storageKey: "hearts_flowers1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "hearts_flowers1.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "443",
      title: "Pockets for Machine Knitters",
      storageKey: "pockets_mini.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "pockets_mini.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "455",
      title: "Learn Contemporary Cables",
      storageKey: "Learn_contemporary_cables.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "Learn_contemporary_cables.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "456",
      title: "Learn Curves and Contours",
      storageKey: "Learn_Curves_and_contours.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "Learn_Curves_and_contours.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "468",
      title: "Learn Modern Stripes",
      storageKey: "LEARN_STRIPES1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "LEARN_STRIPES1.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "469",
      title: "Learn Impactive Jacquard (Fairisle)",
      storageKey: "LEARN_impactive_jacquard.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "LEARN_impactive_jacquard.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "474",
      title: "Cut 'n Sew Neckline Template",
      storageKey: "new_templates_with_link_3_31_2014_2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "new_templates_with_link_3_31_2014_2.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "479",
      title: "Make 5 Star Styles",
      storageKey: "MAKE A STAR SWEATER1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "MAKE A STAR SWEATER1.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "482",
      title: "Top Down Raglan - Bulky - Round Neck - Babies and Kids",
      storageKey: "Bulky_round_baby.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("top-down", "Bulky_round_baby.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "483",
      title: "Top Down Raglan - Standard - V Neck - for Everyone",
      storageKey: "v_neck_standard_all.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "top-down",
        "v_neck_standard_all.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "484",
      title: "Top Down Raglan - Bulky - V Neck - Adults",
      storageKey: "top_down_v_adults.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("top-down", "top_down_v_adults.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "486",
      title: "Top Down Raglan - Bulky - Round Neck - Grownups",
      storageKey: "bulky_round_adults1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "top-down",
        "bulky_round_adults1.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "487",
      title: "Top Down Raglan - Bulky - V Neck - Youngsters",
      storageKey: "bulky_v_younsters.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "top-down",
        "bulky_v_younsters.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "490",
      title: "Learn Knit Flowers",
      storageKey: "FLORAL_book_new.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "FLORAL_book_new.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "495",
      title: "Learn Manipulated Pointelle",
      storageKey: "LEARN POINTELLE.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "LEARN POINTELLE.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "502",
      title: "Machine Knitting Trims and Edges - Double Bed",
      storageKey: "502_Double_Bed_Trims_and_Edges.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "502_Double_Bed_Trims_and_Edges.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "505",
      title: "Machine Knitting Trims and Edges - Single Bed",
      storageKey: "505_Single_bed_trims_and_edges1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "505_Single_bed_trims_and_edges1.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "517",
      title: "Learn Inventive Intarsia",
      storageKey: "LEARN INVENTIVE INTARSIA BOOK.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "LEARN INVENTIVE INTARSIA BOOK.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "522",
      title: "Learn Creative Techniques",
      storageKey: "LEARN CREATIVE TECHNIQUES reduced.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "LEARN CREATIVE TECHNIQUES reduced.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "524",
      title: "Designer Pencil Skirts for Machine Knitters",
      storageKey: "pencil_skirts1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("pencil_skirts1.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "532",
      title: "Nursery Rhyme Knits Vol 2",
      storageKey: "Nursery_rhyme_knits2_optimized2.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "Nursery_rhyme_knits2_optimized2.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "533",
      title: "Nursery Rhyme Knits Vol 1",
      storageKey: "nursery_rhyme_knits1_optimized.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "nursery_rhyme_knits1_optimized.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "535",
      title: "Sailing with the Garter Carriage",
      storageKey: "sailing_with_the_garter_carriage_optimized.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "sailing_with_the_garter_carriage_optimized.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "536",
      title: "Picture Knits",
      storageKey: "picture_knits_optimized.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "picture_knits_optimized.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "589",
      title: "A Guide to Knitting with Yarn on Cones",
      storageKey: "yarn_counts_doc_PDF_format.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("yarn_counts_doc_PDF_format.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "620",
      title: "Hand Knit to Machine Knit - Stitch Symbols Unravelled",
      storageKey: "hand_knit_to_machine_knit.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "hand_knit_to_machine_knit.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "628",
      title: "Love Gloves",
      storageKey: "Love Gloves.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "Love Gloves.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "629",
      title: "Christmas Socks",
      storageKey: "socks_KIN.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("legacy", "socks_KIN.pdf"),
      active: false,
      approved: true,
    },
    {
      itemId: "675",
      title: "Decorative Raglan Seams for Machine Knitters",
      storageKey: "raglan_seam_ebook_optimized.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("raglan_seam_ebook_optimized.pdf"),
      active: true,
      approved: true,
    },
    {
      itemId: "679",
      title: "Learn Fabulous Fairisles",
      storageKey: "FAIRISLE_12_15_reduced.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "legacy",
        "FAIRISLE_12_15_reduced.pdf",
      ),
      active: false,
      approved: true,
    },
    {
      itemId: "680",
      title: "The Ultimate Pleated Skirt eBook",
      storageKey: "Ultimate_Pleated_skirt_optimized.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "Ultimate_Pleated_skirt_optimized.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "682",
      title: "Ultimate Pleated Skirt DAK files",
      storageKey: "Skirt_DAK_Files3.zip",
      downloadUrl: legacyEbookPublicDownloadUrl("Skirt_DAK_Files3.zip"),
      active: true,
      approved: true,
    },
    {
      itemId: "710",
      title: "The ULTIMATE Machine Knit Socks (eBook)",
      storageKey: "electronic_version10-19-16_electronic.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl(
        "electronic_version10-19-16_electronic.pdf",
      ),
      active: true,
      approved: true,
    },
    {
      itemId: "728",
      title: "Add a Hood to Any Knitting Pattern",
      storageKey: "HOOD_WORKBOOK2-15_1.pdf",
      downloadUrl: legacyEbookPublicDownloadUrl("HOOD_WORKBOOK2-15_1.pdf"),
      active: true,
      approved: true,
    },
  ] as const;

const ENTITLEMENT_BY_ITEM_ID: ReadonlyMap<string, LegacyEbookEntitlementEntry> =
  new Map(LEGACY_EBOOK_ENTITLEMENT_CATALOG.map((entry) => [entry.itemId, entry]));

/** Trim + lowercase email for ownership matching. */
export function normalizeLegacyPurchaseEmail(
  email: string | null | undefined,
): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function isLegacyEbookItemExcluded(itemId: string): boolean {
  return LEGACY_EBOOK_EXCLUDED_ITEM_IDS.has(itemId.trim());
}

export function isLegacyEbookItemApproved(itemId: string): boolean {
  const id = itemId.trim();
  if (!id || isLegacyEbookItemExcluded(id)) return false;
  return ENTITLEMENT_BY_ITEM_ID.has(id);
}

export function getLegacyEbookEntitlement(
  itemId: string,
): LegacyEbookEntitlementEntry | null {
  const id = itemId.trim();
  if (!id || isLegacyEbookItemExcluded(id)) return null;
  return ENTITLEMENT_BY_ITEM_ID.get(id) ?? null;
}

export function listApprovedLegacyEbookEntitlements(): LegacyEbookEntitlementEntry[] {
  return [...LEGACY_EBOOK_ENTITLEMENT_CATALOG];
}

export function approvedLegacyEbookTitleCount(): number {
  return LEGACY_EBOOK_ENTITLEMENT_CATALOG.length;
}

/**
 * True when the entitlement has a non-empty public download URL.
 * Callers that need physical verification should also use legacyEbookPublicFileExists.
 */
export function hasVerifiedLegacyEbookDownloadMapping(
  entry: LegacyEbookEntitlementEntry,
): boolean {
  return Boolean(entry.downloadUrl?.trim().startsWith("/downloads/shop/"));
}

/** Strip server-only fields before returning entitlements to the browser. */
export function toCustomerLegacyEbookEntitlement(
  entry: LegacyEbookEntitlementEntry,
): LegacyEbookCustomerEntitlement | null {
  if (!hasVerifiedLegacyEbookDownloadMapping(entry)) return null;
  return {
    itemId: entry.itemId,
    title: entry.title,
    downloadUrl: entry.downloadUrl,
  };
}

/**
 * Verify every approved catalog entry maps to an existing file under public/.
 * Returns missing item IDs (empty when all 47 resolve).
 */
export function findMissingLegacyEbookPublicFiles(
  projectRoot: string = process.cwd(),
): Array<{ itemId: string; title: string; downloadUrl: string }> {
  const missing: Array<{ itemId: string; title: string; downloadUrl: string }> =
    [];
  for (const entry of LEGACY_EBOOK_ENTITLEMENT_CATALOG) {
    if (!legacyEbookPublicFileExists(entry.downloadUrl, projectRoot)) {
      missing.push({
        itemId: entry.itemId,
        title: entry.title,
        downloadUrl: entry.downloadUrl,
      });
    }
  }
  return missing;
}
