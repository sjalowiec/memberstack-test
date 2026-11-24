/**
 * Customer help videos shown at /video-help/{slug}/.
 * Videos shipped in code stay available even when the saved catalog cannot be read.
 * Videos added in admin are appended and cannot replace a shipped page.
 */
import {
  CUSTOMER_HELP_VIDEO_INTRO,
  customerHelpVideos,
  type CustomerHelpVideo,
} from "../../data/customerHelpVideos";
import { normalizeVimeoUrl } from "../videoReplies/vimeoUrl";
import { slugFromTitle } from "../videos/videoSlug";

export const CUSTOMER_HELP_VIDEO_STORE = "customer-help-videos";
export const CUSTOMER_HELP_VIDEO_KEY = "catalog";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIMEO_ID = /^\d{6,20}$/;
const PRIVACY_HASH = /^[A-Za-z0-9]+$/;

export type SavedCustomerHelpVideo = CustomerHelpVideo & {
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerHelpVideoCatalog = {
  videos: SavedCustomerHelpVideo[];
};

export type CustomerHelpVideoAdminRow = {
  slug: string;
  title: string;
  vimeoId: string;
  path: string;
  builtIn: boolean;
  unlisted: boolean;
};

export function customerHelpPath(slug: string): string {
  return `/video-help/${slug}/`;
}

export function emptyCustomerHelpCatalog(): CustomerHelpVideoCatalog {
  return { videos: [] };
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSavedVideo(entry: unknown): SavedCustomerHelpVideo | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  const slug = cleanString(record.slug).toLowerCase();
  const title = cleanString(record.title);
  const intro = cleanString(record.intro);
  const vimeoId = cleanString(record.vimeoId);
  const sourceUrl = cleanString(record.sourceUrl);
  const privacyHash = cleanString(record.privacyHash);
  const createdAt = cleanString(record.createdAt);
  const updatedAt = cleanString(record.updatedAt);
  if (!SLUG.test(slug) || !title || title.length > 200 || !VIMEO_ID.test(vimeoId)) return null;
  if (privacyHash && !PRIVACY_HASH.test(privacyHash)) return null;
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return null;
  return {
    slug,
    title,
    intro: intro || CUSTOMER_HELP_VIDEO_INTRO,
    vimeoId,
    ...(privacyHash ? { privacyHash } : {}),
    sourceUrl,
    createdAt,
    updatedAt,
  };
}

/** `null` means the stored document is the wrong shape and must not be overwritten. */
export function parseCustomerHelpCatalog(raw: unknown): CustomerHelpVideoCatalog | null {
  if (raw == null) return emptyCustomerHelpCatalog();
  if (typeof raw !== "object" || Array.isArray(raw) || !("videos" in raw)) return null;
  const videos = (raw as { videos?: unknown }).videos;
  if (!Array.isArray(videos)) return null;
  const parsed: SavedCustomerHelpVideo[] = [];
  const seen = new Set<string>();
  for (const entry of videos) {
    const video = parseSavedVideo(entry);
    if (!video || seen.has(video.slug) || seen.has(`id:${video.vimeoId}`)) continue;
    seen.add(video.slug);
    seen.add(`id:${video.vimeoId}`);
    parsed.push(video);
  }
  return { videos: parsed };
}

function shippedSlugs(): Set<string> {
  return new Set(customerHelpVideos.map((video) => video.slug));
}

function shippedVimeoIds(): Set<string> {
  return new Set(customerHelpVideos.map((video) => video.vimeoId));
}

/** Shipped pages first, then saved pages. A saved record cannot hide a shipped page. */
export function listCustomerHelpVideos(catalog: CustomerHelpVideoCatalog): CustomerHelpVideo[] {
  const reserved = shippedSlugs();
  const reservedIds = shippedVimeoIds();
  const saved = catalog.videos.filter(
    (video) => !reserved.has(video.slug) && !reservedIds.has(video.vimeoId),
  );
  return [...customerHelpVideos, ...saved];
}

export function findListedCustomerHelpVideo(
  slug: string,
  catalog: CustomerHelpVideoCatalog,
): CustomerHelpVideo | undefined {
  const key = slug.trim().toLowerCase();
  if (!SLUG.test(key)) return undefined;
  return listCustomerHelpVideos(catalog).find((video) => video.slug === key);
}

export function customerHelpAdminRows(catalog: CustomerHelpVideoCatalog): CustomerHelpVideoAdminRow[] {
  const reservedIds = shippedVimeoIds();
  return listCustomerHelpVideos(catalog).map((video) => ({
    slug: video.slug,
    title: video.title,
    vimeoId: video.vimeoId,
    path: customerHelpPath(video.slug),
    builtIn: reservedIds.has(video.vimeoId),
    unlisted: Boolean(video.privacyHash),
  }));
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`.replace(/^-+/, "");
    if (SLUG.test(candidate) && !taken.has(candidate)) return candidate;
  }
  return "";
}

export type CustomerHelpVideoDraft = {
  ok: true;
  video: SavedCustomerHelpVideo;
  created: boolean;
  changed: boolean;
};

export function addCustomerHelpVideo(
  catalog: CustomerHelpVideoCatalog,
  input: { title: unknown; vimeoUrl: unknown; now?: string },
): CustomerHelpVideoDraft | { ok: false; error: string } {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return { ok: false, error: "Enter a title." };
  }
  const title = input.title.trim();
  if (title.length > 200) return { ok: false, error: "Title must be at most 200 characters." };

  const vimeo = normalizeVimeoUrl(input.vimeoUrl);
  if (!vimeo || !VIMEO_ID.test(vimeo.vimeoId)) {
    return {
      ok: false,
      error:
        "Enter a full Vimeo link. For an Unlisted video, paste the link that includes its privacy code.",
    };
  }

  const now = input.now ?? new Date().toISOString();
  const shipped = customerHelpVideos.find((video) => video.vimeoId === vimeo.vimeoId);
  if (shipped) {
    return {
      ok: true,
      created: false,
      changed: false,
      video: {
        ...shipped,
        sourceUrl: vimeo.originalVimeoUrl,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  const saved = catalog.videos.find((video) => video.vimeoId === vimeo.vimeoId);
  if (saved) {
    const privacyHash = vimeo.privacyHash || saved.privacyHash;
    const next: SavedCustomerHelpVideo = {
      ...saved,
      title,
      sourceUrl: vimeo.originalVimeoUrl,
      updatedAt: now,
      ...(privacyHash ? { privacyHash } : {}),
    };
    if (!privacyHash) delete next.privacyHash;
    const changed =
      next.title !== saved.title ||
      next.privacyHash !== saved.privacyHash ||
      next.sourceUrl !== saved.sourceUrl;
    return { ok: true, created: false, changed, video: next };
  }

  const base = slugFromTitle(title);
  if (!base || !SLUG.test(base)) {
    return { ok: false, error: "Use a title with at least one letter or number." };
  }
  const taken = new Set(listCustomerHelpVideos(catalog).map((video) => video.slug));
  const slug = uniqueSlug(base, taken);
  if (!slug) return { ok: false, error: "A page address could not be made from that title." };

  return {
    ok: true,
    created: true,
    changed: true,
    video: {
      slug,
      title,
      intro: CUSTOMER_HELP_VIDEO_INTRO,
      vimeoId: vimeo.vimeoId,
      ...(vimeo.privacyHash ? { privacyHash: vimeo.privacyHash } : {}),
      sourceUrl: vimeo.originalVimeoUrl,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function catalogWithVideo(
  catalog: CustomerHelpVideoCatalog,
  video: SavedCustomerHelpVideo,
): CustomerHelpVideoCatalog {
  if (shippedSlugs().has(video.slug) || shippedVimeoIds().has(video.vimeoId)) return catalog;
  const videos = catalog.videos.filter(
    (entry) => entry.slug !== video.slug && entry.vimeoId !== video.vimeoId,
  );
  videos.push(video);
  return { videos };
}
