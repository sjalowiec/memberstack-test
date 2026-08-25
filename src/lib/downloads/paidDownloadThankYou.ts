/**
 * Display-only copy for paid-download Stripe thank-you pages.
 * Visiting these pages does not record ownership.
 */

import {
  CHARTING_RULERS_PAID_DOWNLOAD,
  CUT_N_SEW_PAID_DOWNLOAD,
  NEEDLE_SELECTION_PAID_DOWNLOAD,
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
  type PaidDownloadCatalogEntry,
} from "./paidDownloadCatalog";

export type PaidDownloadThankYouCopy = {
  slug: string;
  path: string;
  documentTitle: string;
  description: string;
  purchaseName: string;
  downloadHref: string;
  downloadLabel: string;
};

function thankYouCopy(
  entry: PaidDownloadCatalogEntry,
  path: string,
  purchaseName: string,
  downloadLabel: string,
): PaidDownloadThankYouCopy {
  return {
    slug: entry.slug,
    path,
    documentTitle: `Thank You for Your ${purchaseName} Purchase | Knit it Now`,
    description: `Thank you for purchasing ${purchaseName}. Your printable download is ready.`,
    purchaseName,
    downloadHref: entry.downloadUrl,
    downloadLabel,
  };
}

export const CHARTING_RULERS_THANK_YOU: PaidDownloadThankYouCopy = thankYouCopy(
  CHARTING_RULERS_PAID_DOWNLOAD,
  "/shop/thank-you-charting-rulers",
  "Charting Rulers",
  "Download Charting Rulers",
);

export const TECHNIQUE_CARDS_THANK_YOU: PaidDownloadThankYouCopy = thankYouCopy(
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
  "/shop/thank-you-machine-technique-reference-cards",
  TECHNIQUE_CARDS_PAID_DOWNLOAD.title,
  `Download ${TECHNIQUE_CARDS_PAID_DOWNLOAD.title}`,
);

export const CUT_N_SEW_THANK_YOU: PaidDownloadThankYouCopy = thankYouCopy(
  CUT_N_SEW_PAID_DOWNLOAD,
  "/shop/thank-you-cut-n-sew-neckline-templates",
  CUT_N_SEW_PAID_DOWNLOAD.title,
  `Download ${CUT_N_SEW_PAID_DOWNLOAD.title}`,
);

export const NEEDLE_SELECTION_THANK_YOU: PaidDownloadThankYouCopy = thankYouCopy(
  NEEDLE_SELECTION_PAID_DOWNLOAD,
  "/shop/thank-you-needle-selection-worksheet",
  NEEDLE_SELECTION_PAID_DOWNLOAD.title,
  `Download ${NEEDLE_SELECTION_PAID_DOWNLOAD.title}`,
);

export const PAID_DOWNLOAD_THANK_YOU_PAGES: readonly PaidDownloadThankYouCopy[] = [
  CHARTING_RULERS_THANK_YOU,
  TECHNIQUE_CARDS_THANK_YOU,
  CUT_N_SEW_THANK_YOU,
  NEEDLE_SELECTION_THANK_YOU,
];

export const CHARTING_RULERS_THANK_YOU_PATH = CHARTING_RULERS_THANK_YOU.path;
export const CHARTING_RULERS_THANK_YOU_DOWNLOAD_HREF =
  CHARTING_RULERS_THANK_YOU.downloadHref;
export const CHARTING_RULERS_THANK_YOU_DOWNLOAD_LABEL =
  CHARTING_RULERS_THANK_YOU.downloadLabel;

export function getPaidDownloadThankYouBySlug(
  slug: string | null | undefined,
): PaidDownloadThankYouCopy | null {
  const key = typeof slug === "string" ? slug.trim() : "";
  if (!key) return null;
  return PAID_DOWNLOAD_THANK_YOU_PAGES.find((page) => page.slug === key) ?? null;
}
