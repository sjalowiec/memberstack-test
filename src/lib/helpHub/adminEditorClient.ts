import {
  fetchAdminHtml,
  fetchAdminJson,
  getAdminAuthHeaders,
  promptAdminSignIn,
  type AdminHtmlResult,
  type AdminJsonResult,
} from "../admin/adminAuthClient";
import {
  HELP_HUB_PREVIEW_PATH,
  helpHubPreviewBaseHref,
  helpHubPreviewUrlExposesDocument,
  htmlWithHelpHubPreviewBase,
} from "./previewDocument";

export type HelpHubAdminRequestInit = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  fetchAdmin?: typeof fetchAdminJson;
};

export type HelpHubPreviewPayload =
  | { document: Record<string, unknown> }
  | { slug: string };

export function helpHubPreviewRequestUrl(): string {
  return HELP_HUB_PREVIEW_PATH;
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

export function openerPreviewBaseHref(
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  return helpHubPreviewBaseHref(origin);
}

/**
 * Write the authenticated preview HTML into a same-origin about:blank tab.
 * A blob: URL cannot load /_astro CSS, images, or scripts. document.write plus
 * <base href="{site origin}/"> makes root-relative assets resolve on kin-dev.
 */
export function writePreviewHtmlToWindow(
  win: Window,
  html: string,
  options: { baseHref?: string } = {},
): void {
  const baseHref = options.baseHref || openerPreviewBaseHref();
  const complete = htmlWithHelpHubPreviewBase(html, baseHref);
  win.document.open();
  win.document.write(complete);
  win.document.close();
}

export async function requestHelpHubPreview(
  payload: HelpHubPreviewPayload,
  options: {
    fetchHtml?: typeof fetchAdminHtml;
    previewUrl?: string;
  } = {},
): Promise<AdminHtmlResult> {
  const fetchHtml = options.fetchHtml ?? fetchAdminHtml;
  const url = options.previewUrl ?? helpHubPreviewRequestUrl();
  return fetchHtml(url, { method: "POST", body: payload });
}

export async function openHelpHubPreview(
  payload: HelpHubPreviewPayload,
  options: {
    fetchHtml?: typeof fetchAdminHtml;
    previewWindow?: Window | null;
    openWindow?: () => Window | null;
    writeHtml?: typeof writePreviewHtmlToWindow;
    baseHref?: string;
  } = {},
): Promise<AdminHtmlResult> {
  const result = await requestHelpHubPreview(payload, { fetchHtml: options.fetchHtml });
  if (!result.ok || !result.html) {
    options.previewWindow?.close();
    return result;
  }

  const win = options.previewWindow ?? options.openWindow?.() ?? null;
  if (!win) {
    return { ok: false, status: result.status, error: "Preview window was blocked." };
  }
  const writeHtml = options.writeHtml ?? writePreviewHtmlToWindow;
  writeHtml(win, result.html, { baseHref: options.baseHref || openerPreviewBaseHref() });
  try {
    win.opener = null;
  } catch {
    /* ignore */
  }
  return result;
}

export type HelpHubAdminBrowser = {
  request: typeof requestHelpHubAdmin;
  previewUrl: typeof helpHubPreviewRequestUrl;
  openPreview: typeof openHelpHubPreview;
  promptSignIn: typeof promptAdminSignIn;
  ensureToken: typeof getAdminAuthHeaders;
  saveSucceeded: typeof saveSucceeded;
};

export function installHelpHubAdminBrowser(
  target: { kbmHelpHubAdmin?: HelpHubAdminBrowser } = window,
): HelpHubAdminBrowser {
  const api: HelpHubAdminBrowser = {
    request: requestHelpHubAdmin,
    previewUrl: helpHubPreviewRequestUrl,
    openPreview: openHelpHubPreview,
    promptSignIn: promptAdminSignIn,
    ensureToken: getAdminAuthHeaders,
    saveSucceeded,
  };
  target.kbmHelpHubAdmin = api;
  return api;
}

export function bindHelpHubPreviewButtons(
  root: ParentNode = document,
  options: { admin?: () => HelpHubAdminBrowser | undefined } = {},
): void {
  const getAdmin = options.admin ?? (() => window.kbmHelpHubAdmin);
  root.querySelectorAll<HTMLElement>("[data-help-hub-preview-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.getAttribute("data-help-hub-preview-slug")?.trim() || "";
      if (!slug) return;
      const admin = getAdmin();
      if (!admin?.openPreview) return;
      const previewWindow = window.open("", "_blank");
      const result = await admin.openPreview({ slug }, { previewWindow });
      if (!result.ok) {
        previewWindow?.close();
        if (result.needsSignIn) {
          admin.promptSignIn();
          return;
        }
        if (result.forbidden) {
          window.alert(result.error || "Admin access required.");
        }
      }
    });
  });
}

export { helpHubPreviewUrlExposesDocument, HELP_HUB_PREVIEW_PATH, htmlWithHelpHubPreviewBase };

declare global {
  interface Window {
    kbmHelpHubAdmin?: HelpHubAdminBrowser;
  }
}
