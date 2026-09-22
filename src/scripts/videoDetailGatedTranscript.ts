import { getMembershipStatusAuthHeaders } from "../lib/membership/membershipStatusClient";
import {
  parseAuthorizedTranscript,
  renderVideoTranscriptDisclosure,
} from "../lib/transcripts/videoGatedTranscript";

const CATALOG_VIDEO_EMBED_API_PATH = "/.netlify/functions/catalog-video-embed";
const GATED_HOST = '.video-english-transcript[data-transcript-source="gated"]';

function transcriptHost(contentId: string): HTMLElement | null {
  const host = document.querySelector(`${GATED_HOST}[data-content-id="${contentId}"]`);
  return host instanceof HTMLElement ? host : null;
}

export function paintGatedTranscript(contentId: string, paragraphs: string[]): void {
  const host = transcriptHost(contentId);
  if (!host) return;
  if (paragraphs.length === 0) {
    host.innerHTML = "";
    host.setAttribute("hidden", "");
    return;
  }
  host.innerHTML = renderVideoTranscriptDisclosure(paragraphs);
  host.removeAttribute("hidden");
}

function clearGatedTranscript(contentId: string): void {
  const host = transcriptHost(contentId);
  if (!host) return;
  host.innerHTML = "";
  host.setAttribute("hidden", "");
}

async function fetchAuthorizedTranscript(contentId: string): Promise<string[]> {
  const headers = await getMembershipStatusAuthHeaders();
  const params = new URLSearchParams({ contentId, playerApi: "1" });
  const res = await fetch(`${CATALOG_VIDEO_EMBED_API_PATH}?${params.toString()}`, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });
  if (!res.ok) return [];
  let body: { ok?: boolean; transcript?: unknown } | null = null;
  try {
    body = (await res.json()) as { ok?: boolean; transcript?: unknown };
  } catch {
    return [];
  }
  if (!body || body.ok === false) return [];
  return parseAuthorizedTranscript(body.transcript);
}

export async function hydrateGatedTranscript(options: {
  contentId: string;
  hasAccess: boolean;
}): Promise<void> {
  const { contentId, hasAccess } = options;
  if (!contentId) return;
  if (!hasAccess) {
    clearGatedTranscript(contentId);
    return;
  }
  const host = transcriptHost(contentId);
  if (!host) return;
  if (host.querySelector("details.kbm-transcript")) return;
  paintGatedTranscript(contentId, await fetchAuthorizedTranscript(contentId));
}

export function bindGatedTranscriptEmbedListener(contentId: string): void {
  if (!contentId) return;
  window.addEventListener("kbm:catalog-video-embed", (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { contentId?: string; transcript?: unknown }
      | undefined;
    if (!detail || String(detail.contentId ?? "") !== contentId) return;
    paintGatedTranscript(contentId, parseAuthorizedTranscript(detail.transcript));
  });
}
