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
 * Watson nav Admin href. Non-localhost (including production) keeps `/admin`.
 * Localhost uses `/admin/` so the path matches Netlify Basic-Auth `/admin/*`.
 */
export function watsonAdminNavHref(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
): string {
  return detectSiteEnvironment(hostname, options) === "localhost"
    ? `${ADMIN_ROUTES.dashboard}/`
    : ADMIN_ROUTES.dashboard;
}
