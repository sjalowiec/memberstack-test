import {
  fetchAdminJson,
  getAdminAuthHeaders,
  promptAdminSignIn,
  type AdminJsonResult,
} from "../admin/adminAuthClient";

export type HelpHubAdminRequestInit = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  fetchAdmin?: typeof fetchAdminJson;
};

export function helpHubPreviewUrl(slug: string): string {
  return `/help-hub/preview?slug=${encodeURIComponent(slug.trim())}`;
}

export async function requestHelpHubAdmin(
  url: string,
  init: HelpHubAdminRequestInit,
): Promise<AdminJsonResult> {
  const fetchAdmin = init.fetchAdmin ?? fetchAdminJson;
  return fetchAdmin(url, { method: init.method, body: init.body });
}

export function saveSucceeded(result: AdminJsonResult): boolean {
  return result.ok === true && result.status >= 200 && result.status < 300;
}

export type HelpHubAdminBrowser = {
  request: typeof requestHelpHubAdmin;
  previewUrl: typeof helpHubPreviewUrl;
  promptSignIn: typeof promptAdminSignIn;
  ensureToken: typeof getAdminAuthHeaders;
  saveSucceeded: typeof saveSucceeded;
};

export function installHelpHubAdminBrowser(
  target: { kbmHelpHubAdmin?: HelpHubAdminBrowser } = window,
): HelpHubAdminBrowser {
  const api: HelpHubAdminBrowser = {
    request: requestHelpHubAdmin,
    previewUrl: helpHubPreviewUrl,
    promptSignIn: promptAdminSignIn,
    ensureToken: getAdminAuthHeaders,
    saveSucceeded,
  };
  target.kbmHelpHubAdmin = api;
  return api;
}

declare global {
  interface Window {
    kbmHelpHubAdmin?: HelpHubAdminBrowser;
  }
}
