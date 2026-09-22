import { getMembershipStatusAuthHeaders } from "../lib/membership/membershipStatusClient";
import {
  parseAuthorizedJumpLinks,
  renderVideoJumpLinkButtons,
} from "../lib/jumplinks/videoJumpLinkButtons";
import type { CatalogChapterRow } from "../lib/catalogVideoChapters";

const CATALOG_VIDEO_EMBED_API_PATH = "/.netlify/functions/catalog-video-embed";

const MIGRATED_NAV = '.video-jumplinks[data-jump-source="migrated"]';

function jumplinksContainer(contentId: string): HTMLElement | null {
  const nav = document.querySelector(
    `${MIGRATED_NAV}[data-content-id="${contentId}"]`,
  );
  if (!(nav instanceof HTMLElement)) return null;
  const host = nav.querySelector("#jumplinks");
  return host instanceof HTMLElement ? host : null;
}

export function paintMigratedJumpLinks(contentId: string, links: CatalogChapterRow[]): void {
  const host = jumplinksContainer(contentId);
  if (!host || links.length === 0) return;
  host.innerHTML = renderVideoJumpLinkButtons(links);
}

async function fetchAuthorizedJumpLinks(contentId: string): Promise<CatalogChapterRow[]> {
  const headers = await getMembershipStatusAuthHeaders();
  const params = new URLSearchParams({ contentId, playerApi: "1" });
  const res = await fetch(`${CATALOG_VIDEO_EMBED_API_PATH}?${params.toString()}`, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) return [];
  let body: { ok?: boolean; jumplinks?: unknown } | null = null;
  try {
    body = (await res.json()) as { ok?: boolean; jumplinks?: unknown };
  } catch {
    return [];
  }
  if (!body || body.ok === false) return [];
  return parseAuthorizedJumpLinks(body.jumplinks);
}

/** Local Astro-dev fallback only. Not used for production member delivery. */
async function fetchDevBypassJumpLinks(contentId: string): Promise<CatalogChapterRow[]> {
  const res = await fetch(`/api/jumplinks/${encodeURIComponent(contentId)}.json`);
  if (!res.ok) return [];
  try {
    const body = (await res.json()) as { jumplinks?: unknown };
    return parseAuthorizedJumpLinks(body.jumplinks);
  } catch {
    return [];
  }
}

export async function hydrateMigratedJumpLinks(options: {
  contentId: string;
  hasAccess: boolean;
  videoDevBypass: boolean;
}): Promise<void> {
  const { contentId, hasAccess, videoDevBypass } = options;
  if (!contentId || !hasAccess) return;
  const host = jumplinksContainer(contentId);
  if (!host) return;
  if (host.querySelector("button.jumplink")) return;

  let links = await fetchAuthorizedJumpLinks(contentId);
  if (links.length === 0 && videoDevBypass) {
    links = await fetchDevBypassJumpLinks(contentId);
  }
  paintMigratedJumpLinks(contentId, links);
}

export function bindMigratedJumpLinkEmbedListener(contentId: string): void {
  if (!contentId) return;
  window.addEventListener("kbm:catalog-video-embed", (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { contentId?: string; jumplinks?: unknown }
      | undefined;
    if (!detail || String(detail.contentId ?? "") !== contentId) return;
    paintMigratedJumpLinks(contentId, parseAuthorizedJumpLinks(detail.jumplinks));
  });
}
