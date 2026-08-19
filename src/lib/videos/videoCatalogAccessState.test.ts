import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  nextVideoCatalogAuthCategory,
  readSitewideAccessPublication,
  reconcileCatalogAccessFromOwnPoll,
  shouldRefreshVideoCatalogAccessOnPageShow,
  shouldShowVideoCatalogLock,
  viewerFromSitewidePublication,
} from "./videoCatalogAccessState";

const FREE = "__free__";
const catalogSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../pages/videos/index.astro"),
  "utf8",
);

const loggedOutPoll = {
  isLoggedIn: false,
  hasVideoAccess: false,
  member: null,
  resolved: true,
};

const memberPoll = {
  isLoggedIn: true,
  hasVideoAccess: true,
  member: { id: "mem_1" },
  resolved: true,
};

describe("videoCatalogAccessState", () => {
  it("does not show locks while auth is unresolved", () => {
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: "checking",
        hasVideoAccess: false,
      }),
    ).toBe(false);
  });

  it("keeps a returning member in member-access state when the catalog poll is late", () => {
    const next = reconcileCatalogAccessFromOwnPoll({
      catalogViewer: loggedOutPoll,
      sitewide: "granted",
    });
    expect(next?.accessState).toBe("has_access");
    expect(next?.viewer.hasVideoAccess).toBe(true);
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: next!.accessState,
        hasVideoAccess: next!.viewer.hasVideoAccess,
      }),
    ).toBe(false);
  });

  it("does not treat an early catalog poll as logged-out before the sitewide snapshot exists", () => {
    expect(readSitewideAccessPublication(undefined, false)).toBe("unpublished");
    expect(
      reconcileCatalogAccessFromOwnPoll({
        catalogViewer: loggedOutPoll,
        sitewide: "unpublished",
      }),
    ).toBeNull();
    expect(
      nextVideoCatalogAuthCategory({
        accessState: "checking",
        hasVideoAccess: false,
        hasExplicitCategoryRequest: false,
        categoryTouchedByUser: false,
        authDefaultFreeApplied: false,
        currentCategory: "",
        freeFilterValue: FREE,
      }),
    ).toBe("none");
  });

  it("refreshes stale auth UI only on bfcache pageshow", () => {
    expect(shouldRefreshVideoCatalogAccessOnPageShow({ persisted: true })).toBe(true);
    expect(shouldRefreshVideoCatalogAccessOnPageShow({ persisted: false })).toBe(false);
    expect(shouldRefreshVideoCatalogAccessOnPageShow({})).toBe(false);
  });

  it("shows locked Free Videos for a guest after sitewide auth confirms no access", () => {
    const denied = viewerFromSitewidePublication(
      { hasMemberAccess: false, viewerAccessState: "loggedOut" },
      false,
    );
    expect(denied?.accessState).toBe("logged_out");
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: "logged_out",
        hasVideoAccess: false,
      }),
    ).toBe(true);
    expect(
      nextVideoCatalogAuthCategory({
        accessState: "logged_out",
        hasVideoAccess: false,
        hasExplicitCategoryRequest: false,
        categoryTouchedByUser: false,
        authDefaultFreeApplied: false,
        currentCategory: "",
        freeFilterValue: FREE,
      }),
    ).toBe("apply-free");
  });

  it("respects an explicit ?cat=free filter after member access resolves", () => {
    expect(
      nextVideoCatalogAuthCategory({
        accessState: "has_access",
        hasVideoAccess: true,
        hasExplicitCategoryRequest: true,
        categoryTouchedByUser: false,
        authDefaultFreeApplied: false,
        currentCategory: FREE,
        freeFilterValue: FREE,
      }),
    ).toBe("none");
  });

  it("restores All Videos when Free was auto-applied and member access later resolves", () => {
    expect(
      nextVideoCatalogAuthCategory({
        accessState: "has_access",
        hasVideoAccess: true,
        hasExplicitCategoryRequest: false,
        categoryTouchedByUser: false,
        authDefaultFreeApplied: true,
        currentCategory: FREE,
        freeFilterValue: FREE,
      }),
    ).toBe("restore-all");
  });

  it("can upgrade to member access from a successful catalog poll even if the snapshot is late", () => {
    const next = reconcileCatalogAccessFromOwnPoll({
      catalogViewer: memberPoll,
      sitewide: "unpublished",
    });
    expect(next?.accessState).toBe("has_access");
  });

  it("applies logged-in no-access from the sitewide snapshot", () => {
    const next = viewerFromSitewidePublication(
      { hasMemberAccess: false, viewerAccessState: "loggedInNoAccess" },
      false,
      { id: "mem_free" },
    );
    expect(next?.accessState).toBe("no_access");
    expect(next?.viewer.isLoggedIn).toBe(true);
    expect(
      nextVideoCatalogAuthCategory({
        accessState: "no_access",
        hasVideoAccess: false,
        hasExplicitCategoryRequest: false,
        categoryTouchedByUser: false,
        authDefaultFreeApplied: false,
        currentCategory: "",
        freeFilterValue: FREE,
      }),
    ).toBe("apply-free");
  });
});

describe("videos catalog wiring", () => {
  it("uses the shared access helper and refreshes on bfcache pageshow", () => {
    expect(catalogSrc).toContain("from \"../../lib/videos/videoCatalogAccessState\"");
    expect(catalogSrc).toContain("shouldRefreshVideoCatalogAccessOnPageShow");
    expect(catalogSrc).toContain("pageshow");
  });
});
