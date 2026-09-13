import { describe, expect, it, vi } from "vitest";

import {
  LESSON_PREVIEW_PATH,
  lessonPreviewRequestUrl,
  lessonPreviewUrlExposesDocument,
  openLessonPreview,
  requestLessonPreview,
  writePreviewHtmlToWindow,
} from "./adminEditorClient";
import {
  collectPreviewStylesheetHrefs,
  previewAssetResolvesToSiteOrigin,
} from "./previewDocument";

function htmlResponse(status: number, body: string, contentType = "text/html"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": contentType }),
    json: async () => {
      try {
        return JSON.parse(body);
      } catch {
        return {};
      }
    },
    text: async () => body,
  } as Response;
}

describe("Lesson authenticated preview client", () => {
  it("POSTs the current document with a fresh bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(200, "<html><body>Preview — saved draft</body></html>"),
    );
    const result = await requestLessonPreview(
      {
        document: {
          slug: "new-member-lesson",
          title: "Unsaved title",
          status: "draft",
        },
      },
      {
        fetchHtml: (url, init) =>
          import("../admin/adminAuthClient").then(({ fetchAdminHtml }) =>
            fetchAdminHtml(url, {
              ...init,
              fetchImpl,
              getHeaders: async () => ({ Authorization: "Bearer jwt-sue" }),
              allowMissingToken: false,
            }),
          ),
      },
    );
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(LESSON_PREVIEW_PATH);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-sue");
    expect(String(init.body)).toContain("Unsaved title");
    expect(lessonPreviewUrlExposesDocument(url)).toBe(false);
    expect(lessonPreviewRequestUrl()).toBe("/lessons/preview");
  });

  it("returns 401 Sign In when the token is missing", async () => {
    const fetchImpl = vi.fn();
    const { fetchAdminHtml } = await import("../admin/adminAuthClient");
    const result = await fetchAdminHtml(LESSON_PREVIEW_PATH, {
      method: "POST",
      body: { slug: "tuck-on-the-lk150" },
      fetchImpl,
      getHeaders: async () => ({}),
      allowMissingToken: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe(401);
    expect(result.needsSignIn).toBe(true);
  });

  it("returns 403 Admin access required for a signed-in non-admin", async () => {
    const { fetchAdminHtml } = await import("../admin/adminAuthClient");
    const result = await fetchAdminHtml(LESSON_PREVIEW_PATH, {
      method: "POST",
      body: { slug: "tuck-on-the-lk150" },
      fetchImpl: async () =>
        htmlResponse(403, JSON.stringify({ ok: false, error: "Admin access required." }), "application/json"),
      getHeaders: async () => ({ Authorization: "Bearer jwt-member" }),
      allowMissingToken: false,
    });
    expect(result.status).toBe(403);
    expect(result.forbidden).toBe(true);
  });

  it("writes complete HTML into a same-origin tab with site base, not a blob URL", () => {
    const origin = "https://kin-dev.netlify.app";
    const astroHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><link rel="stylesheet" href="/_astro/LessonPage.Ab12.css"></head><body class="lesson-page"><h1>Preview</h1></body></html>`;
    let written = "";
    const previewWindow = {
      close: vi.fn(),
      opener: {},
      document: {
        open: vi.fn(),
        write: (html: string) => {
          written = html;
        },
        close: vi.fn(),
      },
    } as unknown as Window;

    writePreviewHtmlToWindow(previewWindow, astroHtml, { baseHref: origin });

    expect(written).toContain(`<base href="${origin}/">`);
    expect(written).not.toMatch(/blob:/i);
    const hrefs = collectPreviewStylesheetHrefs(written);
    for (const href of hrefs) {
      expect(previewAssetResolvesToSiteOrigin(href, origin)).toBe(true);
    }
  });

  it("does not open HTML when unauthorized", async () => {
    const writeHtml = vi.fn();
    const previewWindow = { close: vi.fn(), opener: {} } as unknown as Window;
    const result = await openLessonPreview(
      { slug: "tuck-on-the-lk150" },
      {
        previewWindow,
        writeHtml,
        fetchHtml: async () => ({
          ok: false,
          status: 401,
          error: "Sign in required.",
          needsSignIn: true,
        }),
      },
    );
    expect(result.ok).toBe(false);
    expect(writeHtml).not.toHaveBeenCalled();
    expect(previewWindow.close).toHaveBeenCalled();
  });
});
