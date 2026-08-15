/**
 * Test-only disk checks for legacy ebook public files.
 *
 * Kept out of `legacyEbookEntitlements.ts` so @vercel/nft does not copy
 * `public/downloads` into the Netlify SSR function.
 */
import { existsSync } from "node:fs";
import {
  LEGACY_EBOOK_ENTITLEMENT_CATALOG,
  legacyEbookPublicUrlToFilesystemPath,
} from "./legacyEbookEntitlements";

export function legacyEbookPublicFileExists(
  downloadUrl: string,
  projectRoot: string = process.cwd(),
): boolean {
  const fsPath = legacyEbookPublicUrlToFilesystemPath(downloadUrl, projectRoot);
  return Boolean(fsPath && existsSync(fsPath));
}

/** Returns missing item IDs (empty when all approved entitlements resolve). */
export function findMissingLegacyEbookPublicFiles(
  projectRoot: string = process.cwd(),
): Array<{ itemId: string; title: string; downloadUrl: string }> {
  const missing: Array<{ itemId: string; title: string; downloadUrl: string }> = [];
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
