import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import { hasMemberAccess } from "../memberAccess";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import { decideGatedVimeoPlayback } from "./gatedVimeoEmbedDelivery";
import {
  nextVideoCatalogAuthCategory,
  readSitewideAccessPublication,
  reconcileCatalogAccessFromOwnPoll,
  shouldRefreshVideoCatalogAccessOnPageShow,
  shouldShowVideoCatalogLock,
  viewerFromSitewidePublication,
  type VideoCatalogAccessState,
} from "./videoCatalogAccessState";

const FREE = "__free__";
const catalogSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../pages/videos/index.astro"),
  "utf8",
);

const LEGACY = FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;

const member257 = { content_id: 257, access_level: "member" as const };
const member259 = { content_id: 259, access_level: "member" as const };
const public258 = { content_id: 258, access_level: "public" as const };
const tuesdayTip = { content_id: 249, access_level: "member" as const, isTipOfWeek: true };

const ACCESS_STATES: VideoCatalogAccessState[] = [
  "checking",
  "logged_out",
  "no_access",
  "has_access",
];

function catalogLockFor(
  video: {
    access_level?: string;
    isTipOfWeek?: boolean;
    tipOfWeek?: boolean;
  },
  accessState: VideoCatalogAccessState,
) {
  return shouldShowVideoCatalogLock({
    isMemberOnly: catalogVideoPlaybackAccess(video) === "member",
    accessState,
  });
}

function payload(planId: string, status = "ACTIVE") {
  return {
    data: {
      id: "mem_1",
      auth: { email: "test@knititnow.com" },
      planConnections: [{ planId, status }],
    },
  };
}

const loggedOutPoll = {
  isLoggedIn: false,
  hasVideoAccess: false,
  member: null,
  resolved: true,
};

const expiredLegacyPoll = {
  isLoggedIn: true,
  hasVideoAccess: false,
  member: { id: "mem_expired" },
  resolved: true,
};

const memberPoll = {
  isLoggedIn: true,
  hasVideoAccess: true,
  member: { id: "mem_1" },
  resolved: true,
};

describe("shouldShowVideoCatalogLock", () => {
  it("shows locks on member-only videos while access is unresolved", () => {
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: "checking",
        hasVideoAccess: false,
      }),
    ).toBe(true);
  });

  it("shows locks for logged-out visitors on member-only videos", () => {
    expect(catalogLockFor(member257, "logged_out")).toBe(true);
    expect(catalogLockFor(member259, "logged_out")).toBe(true);
  });

  it("shows locks for expired legacy and logged-in nonmembers on member-only videos", () => {
    expect(catalogLockFor(member257, "no_access")).toBe(true);
    expect(catalogLockFor(member259, "no_access")).toBe(true);
  });

  it("hides locks for active legacy and active paid members on member-only videos", () => {
    expect(catalogLockFor(member257, "has_access")).toBe(false);
    expect(catalogLockFor(member259, "has_access")).toBe(false);
  });

  it("never locks public videos or the current Tuesday Tip", () => {
    for (const state of ACCESS_STATES) {
      expect(catalogLockFor(public258, state)).toBe(false);
      expect(catalogLockFor({ access_level: "free" }, state)).toBe(false);
      expect(catalogLockFor(tuesdayTip, state)).toBe(false);
    }
  });

  it("grants catalog unlock from a valid Watson date without the free plan", () => {
    expect(
      hasMemberAccess(
        {
          data: {
            id: "mem_migrated",
            planConnections: [],
          },
        },
        { legacyPaidThroughYmd: "2026-10-07", todayYmd: "2026-09-08" },
      ),
    ).toBe(true);
    expect(catalogLockFor(member257, "has_access")).toBe(false);
    expect(catalogLockFor(public258, "has_access")).toBe(false);
    expect(catalogLockFor(tuesdayTip, "no_access")).toBe(false);
    expect(catalogLockFor(member257, "no_access")).toBe(true);
  });

  it("does not treat a stale hasVideoAccess flag as membership", () => {
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: "checking",
        hasVideoAccess: true,
      }),
    ).toBe(true);
    expect(
      shouldShowVideoCatalogLock({
        isMemberOnly: true,
        accessState: "no_access",
        hasVideoAccess: true,
      }),
    ).toBe(true);
  });
});

describe("catalog locks and playback agree", () => {
  it("denies expired legacy playback on videos 257 and 259 and shows catalog locks", () => {
    const expiredAccess = hasMemberAccess(payload(LEGACY), {
      legacyPaidThroughYmd: "2020-01-01",
      todayYmd: "2026-09-08",
    });
    expect(expiredAccess).toBe(false);

    for (const video of [member257, member259]) {
      expect(catalogVideoPlaybackAccess(video)).toBe("member");
      expect(catalogLockFor(video, "no_access")).toBe(true);
      expect(
        decideGatedVimeoPlayback({
          accessLevel: "member",
          videoDevBypass: false,
          membershipResolved: true,
          hasMemberAccess: expiredAccess,
          isLoggedIn: true,
          embedSrc: "https://player.vimeo.com/video/1",
        }),
      ).toEqual({ action: "lock", showLogin: false });
    }
  });

  it("unlocks active legacy and paid members on member-only catalog cards and playback", () => {
    const activeLegacy = hasMemberAccess(payload(LEGACY), {
      legacyPaidThroughYmd: "2026-12-01",
      todayYmd: "2026-09-08",
    });
    const activePaid = hasMemberAccess(payload(PAID));
    expect(activeLegacy).toBe(true);
    expect(activePaid).toBe(true);

    expect(catalogLockFor(member257, "has_access")).toBe(false);
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: activeLegacy,
        isLoggedIn: true,
        embedSrc: "https://player.vimeo.com/video/151849234",
      }),
    ).toEqual({
      action: "unlock",
      iframeSrc: "https://player.vimeo.com/video/151849234",
    });
    expect(
      decideGatedVimeoPlayback({
        accessLevel: "member",
        videoDevBypass: false,
        membershipResolved: true,
        hasMemberAccess: activePaid,
        isLoggedIn: true,
        embedSrc: "https://player.vimeo.com/video/151856465",
      }),
    ).toEqual({
      action: "unlock",
      iframeSrc: "https://player.vimeo.com/video/151856465",
    });
  });
});

describe("videoCatalogAccessState", () => {
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

  it("does not treat a logged-in body class as membership", () => {
    expect(readSitewideAccessPublication(undefined, true)).toBe("unpublished");
    expect(
      readSitewideAccessPublication(
        { hasMemberAccess: false, viewerAccessState: "loggedInNoAccess" },
        true,
      ),
    ).toBe("denied");
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

  it("finalizes expired-legacy no-access from a resolved catalog poll before the snapshot", () => {
    const next = reconcileCatalogAccessFromOwnPoll({
      catalogViewer: expiredLegacyPoll,
      sitewide: "unpublished",
    });
    expect(next?.accessState).toBe("no_access");
    expect(next?.viewer.isLoggedIn).toBe(true);
    expect(catalogLockFor(member257, next!.accessState)).toBe(true);
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
    expect(catalogSrc).toContain("hasMemberAccess(res)");
  });

  it("does not strip lock overlays or wait for resolved auth to show them", () => {
    expect(catalogSrc).toContain("shouldShowVideoCatalogLock");
    expect(catalogSrc).not.toContain("hideAllVisibleLockIconsForAccess");
    expect(catalogSrc).not.toContain("removeLockedUiArtifacts");
    expect(catalogSrc).not.toContain("applyAccessUiState");
  });
});
