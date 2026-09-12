import { requireAdminForRequest } from "../admin/requireAdminRequest";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";
import {
  persistKinCourseAdminPreviewCookie,
  readKinAdminPreviewGrant,
  type KinCoursePreviewCookieStore,
} from "./adminPreviewGrant";

export function kinCourseEnv(): DetectSiteEnvironmentOptions {
  return {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  };
}

/** True when the URL asks for draft preview. Auth is checked separately. */
export function kinCoursePreviewRequested(url: URL): boolean {
  return url.searchParams.get("preview") === "true";
}

export type KinCourseCookieStore = KinCoursePreviewCookieStore;

export type KinCourseLoadOptions = {
  hostname: string;
  env: DetectSiteEnvironmentOptions;
  includeDrafts: boolean;
  preview: boolean;
};

/**
 * Unpublished numeric-course preview uses the same Memberstack admin allowlist
 * as Help Hub and member-lesson previews (`requireAdminForRequest`). Browser GET
 * navigation does not send `Authorization: Bearer`; Help Hub/lesson previews send
 * that header from `getMemberCookie()` on fetch. There is no host-only or
 * query-string-only bypass.
 */
export async function kinCourseAdminPreviewGranted(
  request: Request,
  cookies?: KinCourseCookieStore,
): Promise<{ granted: boolean; memberId?: string }> {
  try {
    if (readKinAdminPreviewGrant(cookies)) {
      return { granted: true };
    }
    const auth = await requireAdminForRequest(request, cookies);
    if (auth.ok === true) {
      return { granted: true, memberId: auth.member.id };
    }
    return { granted: false };
  } catch {
    return { granted: false };
  }
}

/** True when unpublished content 404s but `?preview=true` asked for admin preview. */
export function kinCourseNeedsAdminPreviewBootstrap(
  previewRequested: boolean,
  bundle: unknown,
): boolean {
  return previewRequested && bundle == null;
}

export async function kinCourseLoadOptions(
  url: URL,
  request: Request,
  cookies?: KinCourseCookieStore,
): Promise<KinCourseLoadOptions> {
  const env = kinCourseEnv();
  if (!kinCoursePreviewRequested(url)) {
    return {
      hostname: url.hostname,
      env,
      includeDrafts: false,
      preview: false,
    };
  }

  const { granted, memberId } = await kinCourseAdminPreviewGranted(request, cookies);
  if (granted && memberId) {
    persistKinCourseAdminPreviewCookie(cookies, url, memberId);
  }
  return {
    hostname: url.hostname,
    env,
    includeDrafts: granted,
    preview: granted,
  };
}
