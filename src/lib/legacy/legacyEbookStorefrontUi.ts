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
