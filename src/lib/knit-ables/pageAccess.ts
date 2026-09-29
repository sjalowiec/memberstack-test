/**
 * Request-time Knit-able visibility.
 * Unpublished and scheduled pages are real 404s unless a Watson admin asks to preview.
 */
import type { WatsonQueryFn } from "../watson/memberSearch";
import { isWatsonSessionAuthenticated } from "../watson/watsonAuth";
import { loadKnitAblePublishDates } from "./scheduleStore";
import {
  isKnownKnitAbleSlug,
  knitAblePublicationStatus,
  knitAbleSlugFromPath,
  type KnitAblePublicationStatus,
} from "./schedule";

export const KNIT_ABLE_CACHE_CONTROL = "private, no-store";

export function applyKnitAbleCacheHeaders(headers: Headers): void {
  headers.set("Cache-Control", KNIT_ABLE_CACHE_CONTROL);
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Netlify-CDN-Cache-Control", "no-store");
}

export type KnitAblePageAccess =
  | {
      visible: true;
      preview: boolean;
      httpStatus: 200;
      publishDate: string | null;
      status: KnitAblePublicationStatus;
    }
  | {
      visible: false;
      preview: false;
      httpStatus: 404 | 503;
      publishDate: null;
      status: null;
    };

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

function hidden(httpStatus: 404 | 503): KnitAblePageAccess {
  return {
    visible: false,
    preview: false,
    httpStatus,
    publishDate: null,
    status: null,
  };
}

export function decideKnitAbleVisibility(input: {
  status: KnitAblePublicationStatus;
  previewRequested: boolean;
  authenticated: boolean;
}): "public" | "preview" | "not-found" {
  if (input.status === "published") return "public";
  if (input.previewRequested && input.authenticated) return "preview";
  return "not-found";
}

export async function loadKnitAblePageAccess(options: {
  path: string;
  url: URL;
  cookies: CookieStore;
  now?: Date;
  queryFn?: WatsonQueryFn;
  isAuthenticated?: boolean;
}): Promise<KnitAblePageAccess> {
  const now = options.now ?? new Date();
  const slug = knitAbleSlugFromPath(options.path);
  if (!slug || !isKnownKnitAbleSlug(slug)) return hidden(404);

  let publishDate: string | null = null;
  try {
    const dates = await loadKnitAblePublishDates(options.queryFn);
    publishDate = Object.prototype.hasOwnProperty.call(dates, slug) ? dates[slug] ?? null : null;
  } catch (error) {
    console.error(
      "[knit-ables] schedule lookup failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return hidden(503);
  }

  const status = knitAblePublicationStatus(publishDate, now);
  const authenticated =
    options.isAuthenticated ?? isWatsonSessionAuthenticated(options.cookies);
  const decision = decideKnitAbleVisibility({
    status,
    previewRequested: options.url.searchParams.get("preview") === "1",
    authenticated,
  });
  if (decision === "not-found") return hidden(404);
  return {
    visible: true,
    preview: decision === "preview",
    httpStatus: 200,
    publishDate,
    status,
  };
}
