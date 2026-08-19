/**
 * Videos catalog access-state rules.
 *
 * Sitewide BaseLayout snapshot/events are the source of truth for logged-out /
 * no-access UI. The catalog's own getAppAndMember poll must not finalize a
 * logged-out or Free Videos state before that snapshot is published.
 */

export type VideoCatalogAccessState =
  | "checking"
  | "has_access"
  | "logged_out"
  | "no_access";

export type VideoCatalogViewer = {
  isLoggedIn: boolean;
  hasVideoAccess: boolean;
  member: unknown;
};

export type SitewideMemberAccessSnapshot = {
  hasMemberAccess?: boolean;
  viewerAccessState?: string;
} | null | undefined;

export type SitewideAccessPublication = "granted" | "denied" | "unpublished";

export type CatalogPollViewer = VideoCatalogViewer & {
  resolved?: boolean;
};

export function readSitewideAccessPublication(
  snapshot: SitewideMemberAccessSnapshot,
  bodyHasMsLoggedIn = false,
): SitewideAccessPublication {
  if (snapshot && snapshot.hasMemberAccess === true) return "granted";
  if (bodyHasMsLoggedIn) return "granted";
  if (snapshot && snapshot.hasMemberAccess === false) return "denied";
  return "unpublished";
}

export function shouldShowVideoCatalogLock(opts: {
  isMemberOnly: boolean;
  accessState: VideoCatalogAccessState;
  hasVideoAccess: boolean;
}): boolean {
  if (!opts.isMemberOnly) return false;
  if (opts.accessState === "checking") return false;
  if (opts.accessState === "has_access" || opts.hasVideoAccess) return false;
  return opts.accessState === "logged_out" || opts.accessState === "no_access";
}

export function viewerFromSitewidePublication(
  snapshot: SitewideMemberAccessSnapshot,
  bodyHasMsLoggedIn = false,
  currentMember: unknown = null,
): { accessState: VideoCatalogAccessState; viewer: VideoCatalogViewer } | null {
  const publication = readSitewideAccessPublication(snapshot, bodyHasMsLoggedIn);
  if (publication === "unpublished") return null;
  if (publication === "granted") {
    return {
      accessState: "has_access",
      viewer: { isLoggedIn: true, hasVideoAccess: true, member: currentMember },
    };
  }
  if (snapshot?.viewerAccessState === "loggedInNoAccess") {
    return {
      accessState: "no_access",
      viewer: { isLoggedIn: true, hasVideoAccess: false, member: currentMember },
    };
  }
  return {
    accessState: "logged_out",
    viewer: { isLoggedIn: false, hasVideoAccess: false, member: null },
  };
}

export function reconcileCatalogAccessFromOwnPoll(opts: {
  catalogViewer: CatalogPollViewer;
  sitewide: SitewideAccessPublication;
  currentMember?: unknown;
  snapshot?: SitewideMemberAccessSnapshot;
}): { accessState: VideoCatalogAccessState; viewer: VideoCatalogViewer } | null {
  const { catalogViewer, sitewide } = opts;

  if (sitewide === "granted") {
    return {
      accessState: "has_access",
      viewer: {
        isLoggedIn: true,
        hasVideoAccess: true,
        member: catalogViewer.member || opts.currentMember || null,
      },
    };
  }

  if (catalogViewer.resolved && catalogViewer.hasVideoAccess) {
    return {
      accessState: "has_access",
      viewer: {
        isLoggedIn: true,
        hasVideoAccess: true,
        member: catalogViewer.member,
      },
    };
  }

  // Own poll must not finalize no-access until sitewide snapshot is published.
  if (sitewide === "unpublished") return null;

  if (!catalogViewer.resolved) {
    return viewerFromSitewidePublication(opts.snapshot, false, opts.currentMember ?? null);
  }

  if (!catalogViewer.isLoggedIn) {
    return {
      accessState: "logged_out",
      viewer: { isLoggedIn: false, hasVideoAccess: false, member: null },
    };
  }

  return {
    accessState: catalogViewer.hasVideoAccess ? "has_access" : "no_access",
    viewer: {
      isLoggedIn: true,
      hasVideoAccess: Boolean(catalogViewer.hasVideoAccess),
      member: catalogViewer.member,
    },
  };
}

export function nextVideoCatalogAuthCategory(opts: {
  accessState: VideoCatalogAccessState;
  hasVideoAccess: boolean;
  hasExplicitCategoryRequest: boolean;
  categoryTouchedByUser: boolean;
  authDefaultFreeApplied: boolean;
  currentCategory: string;
  freeFilterValue: string;
}): "none" | "apply-free" | "restore-all" {
  if (opts.accessState === "checking") return "none";
  if (opts.hasExplicitCategoryRequest || opts.categoryTouchedByUser) return "none";
  if (opts.accessState === "has_access" || opts.hasVideoAccess) {
    if (opts.authDefaultFreeApplied && opts.currentCategory === opts.freeFilterValue) {
      return "restore-all";
    }
    return "none";
  }
  if (opts.accessState === "logged_out" || opts.accessState === "no_access") {
    return "apply-free";
  }
  return "none";
}

export function shouldRefreshVideoCatalogAccessOnPageShow(event: {
  persisted?: boolean;
}): boolean {
  return event.persisted === true;
}
