import { getMembershipStatusAuthHeaders } from "../lib/membership/membershipStatusClient";
import {
  parseAuthorizedJumpLinks,
  renderVideoJumpLinkButtons,
} from "../lib/jumplinks/videoJumpLinkButtons";
import type { CatalogChapterRow } from "../lib/catalogVideoChapters";

const CATALOG_VIDEO_EMBED_API_PATH = "/.netlify/functions/catalog-video-embed";

const GATED_NAV = '.video-jumplinks[data-jump-source="gated"]';

function gatedNav(contentId: string): HTMLElement | null {
  const nav = document.querySelector(`${GATED_NAV}[data-content-id="${contentId}"]`);
  return nav instanceof HTMLElement ? nav : null;
}

function jumplinksContainer(contentId: string): HTMLElement | null {
  const nav = gatedNav(contentId);
  if (!nav) return null;
  const host = nav.querySelector("#jumplinks");
  return host instanceof HTMLElement ? host : null;
}

export function paintGatedJumpLinks(contentId: string, links: CatalogChapterRow[]): void {
  const host = jumplinksContainer(contentId);
  const nav = gatedNav(contentId);
  if (!host) return;
  if (links.length === 0) {
    host.innerHTML = "";
    nav?.querySelector(".jumplinks-head")?.remove();
    nav?.setAttribute("hidden", "");
    return;
  }
  if (nav && !nav.querySelector(".jumplinks-head")) {
    host.insertAdjacentHTML(
      "beforebegin",
      '<div class="jumplinks-head"><h2>Jump to</h2></div>',
    );
  }
  host.innerHTML = renderVideoJumpLinkButtons(links);
  nav?.removeAttribute("hidden");
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

export async function hydrateGatedJumpLinks(options: {
  contentId: string;
  hasAccess: boolean;
}): Promise<void> {
  const { contentId, hasAccess } = options;
  if (!contentId) return;
  if (!hasAccess) {
    paintGatedJumpLinks(contentId, []);
    return;
  }
  const host = jumplinksContainer(contentId);
  if (!host) return;
  if (host.querySelector("button.jumplink")) {
    gatedNav(contentId)?.removeAttribute("hidden");
    return;
  }

  const links = await fetchAuthorizedJumpLinks(contentId);
  paintGatedJumpLinks(contentId, links);
}

export function bindGatedJumpLinkEmbedListener(contentId: string): void {
  if (!contentId) return;
  window.addEventListener("kbm:catalog-video-embed", (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { contentId?: string; jumplinks?: unknown }
      | undefined;
    if (!detail || String(detail.contentId ?? "") !== contentId) return;
    paintGatedJumpLinks(contentId, parseAuthorizedJumpLinks(detail.jumplinks));
  });
}
