// Member Free badge hidden until Memberstack entitlement flow is implemented.
export const SHOW_LEGACY_EBOOK_MEMBER_FREE_BADGE = false;

/** Legacy store cover image path. */
export function legacyStoreThumbnailPath(filename: string): string {
  if (
    filename.startsWith("/") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://")
  ) {
    return filename;
  }
  return `/store/thumbnails/${filename}`;
}

export function formatLegacyEbookPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
