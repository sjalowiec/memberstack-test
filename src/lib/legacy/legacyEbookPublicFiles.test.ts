/**
 * Build-time / test verification that every approved legacy ebook entitlement
 * points at an existing file under public/downloads/shop (including legacy/ and top-down/).
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_EBOOK_ENTITLEMENT_CATALOG,
  LEGACY_EBOOK_EXCLUDED_ITEM_IDS,
  approvedLegacyEbookTitleCount,
  getLegacyEbookEntitlement,
  legacyEbookPublicUrlToFilesystemPath,
} from "./legacyEbookEntitlements";
import {
  findMissingLegacyEbookPublicFiles,
  legacyEbookPublicFileExists,
} from "./legacyEbookPublicFileCheck";

describe("legacy ebook public file verification", () => {
  it("has exactly 47 approved entitlements and zero missing public files", () => {
    expect(approvedLegacyEbookTitleCount()).toBe(47);
    expect(findMissingLegacyEbookPublicFiles()).toEqual([]);
  });

  it("decodes URL-encoded legacy paths to files under public/", () => {
    const love = getLegacyEbookEntitlement("628");
    expect(love?.downloadUrl).toBe("/downloads/shop/legacy/Love%20Gloves.pdf");
    const fsPath = legacyEbookPublicUrlToFilesystemPath(love!.downloadUrl);
    expect(fsPath).toMatch(/public[/\\]downloads[/\\]shop[/\\]legacy[/\\]Love Gloves\.pdf$/);
    expect(legacyEbookPublicFileExists(love!.downloadUrl)).toBe(true);
  });

  it("covers top-down and legacy subfolders without using the non-recursive manifest", () => {
    expect(legacyEbookPublicFileExists("/downloads/shop/top-down/v_neck_standard_all.pdf")).toBe(
      true,
    );
    expect(
      legacyEbookPublicFileExists("/downloads/shop/legacy/hand_knit_to_machine_knit.pdf"),
    ).toBe(true);
    expect(legacyEbookPublicFileExists("/downloads/shop/legacy/ultimate_socks.pdf")).toBe(
      true,
    );
    expect(
      legacyEbookPublicFileExists(
        "/downloads/shop/electronic_version10-19-16_electronic.pdf",
      ),
    ).toBe(true);
    expect(getLegacyEbookEntitlement("346")?.downloadUrl).toBe(
      "/downloads/shop/legacy/ultimate_socks.pdf",
    );
    expect(getLegacyEbookEntitlement("710")?.downloadUrl).toBe(
      "/downloads/shop/electronic_version10-19-16_electronic.pdf",
    );
  });

  it("does not create entitlements for excluded item IDs", () => {
    for (const itemId of LEGACY_EBOOK_EXCLUDED_ITEM_IDS) {
      expect(getLegacyEbookEntitlement(itemId)).toBeNull();
      expect(
        LEGACY_EBOOK_ENTITLEMENT_CATALOG.some((entry) => entry.itemId === itemId),
      ).toBe(false);
    }
  });
});
