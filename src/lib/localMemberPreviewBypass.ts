/**
 * Explicit localhost member-preview opt-in (`?member=true`).
 *
 * Completes the existing BaseLayout preview flag so the shared snapshot
 * (`__KIN_MEMBER_ACCESS__` / `body.ms-logged-in`) unlocks Skill Builders,
 * Help Hub lessons, and CSS tool gates without a Memberstack login.
 *
 * Safety:
 * - Never true off localhost-style hosts (localhost / loopback / `*.local`).
 * - Never uses `import.meta.env.DEV` (that would also fire on mis-hosted Vite).
 * - Does not change `hasMemberAccess()` / `getViewerAccessState()`.
 * - Does not unlock pattern page/builder gates or server JWT gates.
 */
import { isLocalhostStyleHostname } from "./env/siteEnvironment";
import type { ViewerAccessState } from "./memberAccess";

export type LocalMemberPreviewBypassInput = {
  hostname?: string | null;
  search?: string | null;
  bodyHasDevMember?: boolean;
  kbmDevMember?: boolean;
};

export type SharedMemberAccessSnapshot = {
  hasMemberAccess: boolean;
  viewerAccessState: ViewerAccessState;
};

function readWindowHostname(): string {
  return typeof window !== "undefined" ? window.location?.hostname ?? "" : "";
}

function readWindowSearch(): string {
  return typeof window !== "undefined" ? window.location?.search ?? "" : "";
}

function readBodyHasDevMember(): boolean {
  return typeof document !== "undefined"
    ? Boolean(document.body?.classList.contains("dev-member"))
    : false;
}

function readKbmDevMemberFlag(): boolean {
  return typeof window !== "undefined" ? window.__KBM_DEV_MEMBER__ === true : false;
}

/**
 * True when this page is a localhost-style host AND the visitor opted in with
 * `?member=true` (or the matching `dev-member` / `__KBM_DEV_MEMBER__` flag
 * already set by BaseLayout).
 */
export function localMemberPreviewBypassIsOn(
  input: LocalMemberPreviewBypassInput = {},
): boolean {
  const hostname = input.hostname !== undefined ? input.hostname : readWindowHostname();
  if (!isLocalhostStyleHostname(hostname)) return false;

  const bodyHasDevMember =
    input.bodyHasDevMember !== undefined ? input.bodyHasDevMember : readBodyHasDevMember();
  if (bodyHasDevMember) return true;

  const kbmDevMember =
    input.kbmDevMember !== undefined ? input.kbmDevMember : readKbmDevMemberFlag();
  if (kbmDevMember) return true;

  const search = input.search !== undefined ? input.search : readWindowSearch();
  try {
    return new URLSearchParams(search ?? "").get("member") === "true";
  } catch {
    return false;
  }
}

/**
 * Shared snapshot for BaseLayout. Real Memberstack access always wins.
 * Bypass only fills in when Memberstack did not grant access.
 */
export function resolveSharedMemberAccessSnapshot(input: {
  memberHasAccess: boolean;
  viewerAccessState: ViewerAccessState;
  bypassOn?: boolean;
}): SharedMemberAccessSnapshot {
  if (input.memberHasAccess) {
    return {
      hasMemberAccess: true,
      viewerAccessState: input.viewerAccessState,
    };
  }
  if (input.bypassOn ?? localMemberPreviewBypassIsOn()) {
    return { hasMemberAccess: true, viewerAccessState: "memberAccess" };
  }
  return {
    hasMemberAccess: false,
    viewerAccessState: input.viewerAccessState,
  };
}
