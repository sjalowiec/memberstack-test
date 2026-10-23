import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "./env/siteEnvironment";

export const ADMIN_ROUTES = {
  dashboard: "/admin",
  lessons: "/admin/lessons",
  lessonEdit: "/admin/lessons-edit",
  helpHub: "/admin/help-hub",
  helpHubEdit: "/admin/help-hub-edit",
};

/**
 * Watson nav Admin href. Hosted sites use `/admin`.
 * Localhost keeps a trailing slash for the local dev server.
 */
export function watsonAdminNavHref(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): string {
  return detectSiteEnvironment(hostname, options) === "localhost"
    ? `${ADMIN_ROUTES.dashboard}/`
    : ADMIN_ROUTES.dashboard;
}
