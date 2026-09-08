/**
 * Videos catalog access-state rules.
 *
 * Lock icons use confirmed `hasMemberAccess` only (`accessState === "has_access"`).
 * Login (`body.ms-logged-in`) is not membership. Member-only cards stay locked
 * while access is unresolved so they never flash unlocked.
 *
 * Sitewide BaseLayout snapshot/events are the source of truth for logged-out /
 * Free Videos filter defaults. The catalog's own getAppAndMember poll must not
 * finalize a logged-out state before that snapshot is published. A resolved
 * logged-in poll with no `hasMemberAccess` may finalize `no_access` (expired
 * legacy / nonmembers) without waiting.
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
  _bodyHasMsLoggedIn = false,
): SitewideAccessPublication {
  if (snapshot && snapshot.hasMemberAccess === true) return "granted";
  if (snapshot && snapshot.hasMemberAccess === false) return "denied";
  // Login (`ms-logged-in`) is not membership. Wait for hasMemberAccess.
  return "unpublished";
}

/**
 * Catalog lock overlay. Public/free/tip cards pass `isMemberOnly: false`.
 * Member-only cards stay locked until `hasMemberAccess` is confirmed.
 */
export function shouldShowVideoCatalogLock(opts: {
  isMemberOnly: boolean;
  accessState: VideoCatalogAccessState;
  /** Ignored. Lock visibility uses `accessState === "has_access"` only. */
  hasVideoAccess?: boolean;
}): boolean {
  if (!opts.isMemberOnly) return false;
  return opts.accessState !== "has_access";
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

  // Own poll must not finalize logged-out until sitewide snapshot is published
  // (returning members can look logged-out on an early poll). Logged-in viewers
  // without hasMemberAccess may finalize no-access so expired legacy catalog
  // locks do not wait on the snapshot.
  if (sitewide === "unpublished") {
    if (catalogViewer.resolved && catalogViewer.isLoggedIn && !catalogViewer.hasVideoAccess) {
      return {
        accessState: "no_access",
        viewer: {
          isLoggedIn: true,
          hasVideoAccess: false,
          member: catalogViewer.member,
        },
      };
    }
    return null;
  }

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
