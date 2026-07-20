/**
 * Validate and normalize Vimeo URLs into a safe player embed URL.
 * Never accepts or returns arbitrary HTML.
 */

export type NormalizedVimeoUrl = {
  originalVimeoUrl: string;
  safeVimeoEmbedUrl: string;
  vimeoId: string;
  privacyHash?: string;
};

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function isHttpUrl(value: URL): boolean {
  return value.protocol === "https:" || value.protocol === "http:";
}

function extractPrivacyHash(url: URL, pathSegments: string[]): string | undefined {
  const hParam = url.searchParams.get("h")?.trim();
  if (hParam && /^[a-zA-Z0-9]+$/.test(hParam)) {
    return hParam;
  }

  // https://vimeo.com/{id}/{hash}
  if (pathSegments.length >= 2 && /^\d+$/.test(pathSegments[0]!)) {
    const candidate = pathSegments[1]!;
    if (/^[a-zA-Z0-9]+$/.test(candidate) && candidate.length >= 6) {
      return candidate;
    }
  }

  return undefined;
}

function extractVimeoId(hostname: string, pathSegments: string[]): string | null {
  if (hostname === "player.vimeo.com") {
    // /video/{id}
    if (pathSegments[0] === "video" && pathSegments[1] && /^\d+$/.test(pathSegments[1])) {
      return pathSegments[1];
    }
    return null;
  }

  // /{id} or /{id}/{hash}
  if (pathSegments[0] && /^\d+$/.test(pathSegments[0])) {
    return pathSegments[0];
  }

  // /video/{id}
  if (pathSegments[0] === "video" && pathSegments[1] && /^\d+$/.test(pathSegments[1])) {
    return pathSegments[1];
  }

  // /channels/{channel}/{id}
  if (
    pathSegments[0] === "channels" &&
    pathSegments[2] &&
    /^\d+$/.test(pathSegments[2])
  ) {
    return pathSegments[2];
  }

  // /groups/{group}/videos/{id}
  if (
    pathSegments[0] === "groups" &&
    pathSegments[2] === "videos" &&
    pathSegments[3] &&
    /^\d+$/.test(pathSegments[3])
  ) {
    return pathSegments[3];
  }

  return null;
}

export function normalizeVimeoUrl(raw: unknown): NormalizedVimeoUrl | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isHttpUrl(url)) return null;

  const hostname = url.hostname.toLowerCase();
  if (!VIMEO_HOSTS.has(hostname)) return null;

  const pathSegments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const vimeoId = extractVimeoId(hostname, pathSegments);
  if (!vimeoId) return null;

  const privacyHash = extractPrivacyHash(url, pathSegments);
  const embed = new URL(`https://player.vimeo.com/video/${vimeoId}`);
  if (privacyHash) {
    embed.searchParams.set("h", privacyHash);
  }

  return {
    originalVimeoUrl: trimmed,
    safeVimeoEmbedUrl: embed.toString(),
    vimeoId,
    ...(privacyHash ? { privacyHash } : {}),
  };
}

export function isValidVimeoUrl(raw: unknown): boolean {
  return normalizeVimeoUrl(raw) != null;
}
