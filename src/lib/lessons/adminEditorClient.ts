import {
  fetchAdminHtml,
  fetchAdminJson,
  getAdminAuthHeaders,
  promptAdminSignIn,
  type AdminHtmlResult,
  type AdminJsonResult,
} from "../admin/adminAuthClient";
import {
  LESSON_PREVIEW_PATH,
  lessonPreviewBaseHref,
  lessonPreviewUrlExposesDocument,
  htmlWithLessonPreviewBase,
} from "./previewDocument";

export type LessonAdminRequestInit = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  fetchAdmin?: typeof fetchAdminJson;
};

export type LessonPreviewPayload =
  | { document: Record<string, unknown> }
  | { slug: string };

export function lessonPreviewRequestUrl(): string {
  return LESSON_PREVIEW_PATH;
}

export async function requestLessonAdmin(
  url: string,
  init: LessonAdminRequestInit,
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
  return lessonPreviewBaseHref(origin);
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
  const complete = htmlWithLessonPreviewBase(html, baseHref);
  win.document.open();
  win.document.write(complete);
  win.document.close();
}

export async function requestLessonPreview(
  payload: LessonPreviewPayload,
  options: {
    fetchHtml?: typeof fetchAdminHtml;
    previewUrl?: string;
  } = {},
): Promise<AdminHtmlResult> {
  const fetchHtml = options.fetchHtml ?? fetchAdminHtml;
  const url = options.previewUrl ?? lessonPreviewRequestUrl();
  return fetchHtml(url, { method: "POST", body: payload });
}

export async function openLessonPreview(
  payload: LessonPreviewPayload,
  options: {
    fetchHtml?: typeof fetchAdminHtml;
    previewWindow?: Window | null;
    openWindow?: () => Window | null;
    writeHtml?: typeof writePreviewHtmlToWindow;
    baseHref?: string;
  } = {},
): Promise<AdminHtmlResult> {
  const result = await requestLessonPreview(payload, { fetchHtml: options.fetchHtml });
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

export type LessonAdminBrowser = {
  request: typeof requestLessonAdmin;
  previewUrl: typeof lessonPreviewRequestUrl;
  openPreview: typeof openLessonPreview;
  promptSignIn: typeof promptAdminSignIn;
  ensureToken: typeof getAdminAuthHeaders;
  saveSucceeded: typeof saveSucceeded;
};

export function installLessonAdminBrowser(
  target: { kbmLessonAdmin?: LessonAdminBrowser } = window,
): LessonAdminBrowser {
  const api: LessonAdminBrowser = {
    request: requestLessonAdmin,
    previewUrl: lessonPreviewRequestUrl,
    openPreview: openLessonPreview,
    promptSignIn: promptAdminSignIn,
    ensureToken: getAdminAuthHeaders,
    saveSucceeded,
  };
  target.kbmLessonAdmin = api;
  return api;
}

export function bindLessonPreviewButtons(
  root: ParentNode = document,
  options: { admin?: () => LessonAdminBrowser | undefined } = {},
): void {
  const getAdmin = options.admin ?? (() => window.kbmLessonAdmin);
  root.querySelectorAll<HTMLElement>("[data-lesson-preview-slug]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slug = button.getAttribute("data-lesson-preview-slug")?.trim() || "";
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

export { lessonPreviewUrlExposesDocument, LESSON_PREVIEW_PATH, htmlWithLessonPreviewBase };

declare global {
  interface Window {
    kbmLessonAdmin?: LessonAdminBrowser;
  }
}
