import { requireAdminForRequest } from "../admin/requireAdminRequest";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

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

export type KinCourseCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export type KinCourseLoadOptions = {
  hostname: string;
  env: DetectSiteEnvironmentOptions;
  includeDrafts: boolean;
  preview: boolean;
};

/**
 * Unpublished numeric-course preview uses the same Memberstack admin allowlist
 * as Help Hub and member-lesson previews (`requireAdminForRequest`). There is no
 * host-only bypass: localhost, kin-dev, deploy previews, and production all require
 * a verified admin session.
 */
export async function kinCourseAdminPreviewGranted(
  request: Request,
  cookies?: KinCourseCookieStore,
): Promise<boolean> {
  try {
    const auth = await requireAdminForRequest(request, cookies);
    return auth.ok === true;
  } catch {
    return false;
  }
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

  const preview = await kinCourseAdminPreviewGranted(request, cookies);
  return {
    hostname: url.hostname,
    env,
    includeDrafts: preview,
    preview,
  };
}
