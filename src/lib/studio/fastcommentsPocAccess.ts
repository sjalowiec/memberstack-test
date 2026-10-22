/**
 * Temporary Sue's Studio FastComments proof of concept.
 * Available on kin-dev, localhost, and other non-production hosts.
 * Production custom domains 404 in middleware and on the page.
 */
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const STUDIO_COMMENTS_POC_PAGE = "/studio/comments-test";
export const STUDIO_COMMENTS_POC_API = "/api/studio/fastcomments-sso";

/** Public widget tenant. The API secret never belongs in this module. */
export const STUDIO_FASTCOMMENTS_TENANT_ID = "HwyQ71u_sFy4";

/**
 * Permanent id for this local test post.
 * The Vimeo id is only the current video. Replacing it must not change the discussion.
 */
export const STUDIO_LOCAL_TEST_POST_ID = "local-sues-studio-test";
export const STUDIO_LOCAL_TEST_POST_TITLE = "Sue's Studio";
export const STUDIO_LOCAL_TEST_VIMEO_ID = "1235389908";

/** Contact page query for a private message about one Studio post. */
export function studioPrivateMessageHref(post: { title: string; path: string }): string {
  const title = post.title.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80) || "Sue's Studio";
  const path = studioPostPath(post.path);
  const subject = `Sue's Studio: ${title} (${path})`.slice(0, 200);
  const params = new URLSearchParams({ subject, page: path });
  return `/contact/?${params.toString()}`;
}

function studioPostPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || /[\s\\]/.test(trimmed)) {
    return STUDIO_COMMENTS_POC_PAGE;
  }
  return trimmed.slice(0, 300);
}

/**
 * Discussion id for one Studio post.
 * A numeric Vimeo id is refused so a video replacement cannot start a new thread.
 */
export function studioDiscussionId(postId: string): string {
  const id = postId.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id) || /^\d+$/.test(id)) {
    throw new Error("A Studio discussion is tied to the post id.");
  }
  return `studio-post:${id}`;
}

/** This test page's thread. Independent of STUDIO_LOCAL_TEST_VIMEO_ID. */
export const STUDIO_FASTCOMMENTS_URL_ID = studioDiscussionId(STUDIO_LOCAL_TEST_POST_ID);

export function isStudioCommentsPocRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === STUDIO_COMMENTS_POC_PAGE || normalized === STUDIO_COMMENTS_POC_API;
}

/** Managed session pages. The hardcoded comments test stays on its own route. */
export function isManagedStudioSessionRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === STUDIO_COMMENTS_POC_PAGE) return false;
  return /^\/studio\/[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(normalized);
}

/** True when this proof must not be served. */
export function isStudioCommentsPocProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): boolean {
  return detectSiteEnvironment(hostname, options) === "production";
}
