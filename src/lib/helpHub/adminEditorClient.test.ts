import { describe, expect, it, vi } from "vitest";

import {
  HELP_HUB_PREVIEW_PATH,
  helpHubPreviewRequestUrl,
  helpHubPreviewUrlExposesDocument,
  openHelpHubPreview,
  requestHelpHubPreview,
} from "./adminEditorClient";

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

describe("Help Hub authenticated preview client", () => {
  it("POSTs the current document with a fresh bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(200, "<html><body>Preview — saved draft</body></html>"),
    );
    const result = await requestHelpHubPreview(
      {
        document: {
          slug: "patterns-for-lk150",
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
    expect(result.html).toContain("Preview — saved draft");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HELP_HUB_PREVIEW_PATH);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-sue");
    expect(String(init.body)).toContain("Unsaved title");
    expect(helpHubPreviewUrlExposesDocument(url)).toBe(false);
    expect(helpHubPreviewRequestUrl()).toBe("/help-hub/preview");
  });

  it("returns 401 Sign In when the token is missing", async () => {
    const fetchImpl = vi.fn();
    const { fetchAdminHtml } = await import("../admin/adminAuthClient");
    const result = await fetchAdminHtml(HELP_HUB_PREVIEW_PATH, {
      method: "POST",
      body: { slug: "patterns-for-lk150" },
      fetchImpl,
      getHeaders: async () => ({}),
      allowMissingToken: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.needsSignIn).toBe(true);
  });

  it("returns 403 Admin access required for a signed-in non-admin", async () => {
    const { fetchAdminHtml } = await import("../admin/adminAuthClient");
    const result = await fetchAdminHtml(HELP_HUB_PREVIEW_PATH, {
      method: "POST",
      body: { slug: "patterns-for-lk150" },
      fetchImpl: async () =>
        htmlResponse(403, JSON.stringify({ ok: false, error: "Admin access required." }), "application/json"),
      getHeaders: async () => ({ Authorization: "Bearer jwt-member" }),
      allowMissingToken: false,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.forbidden).toBe(true);
    expect(result.error).toMatch(/admin access required/i);
  });

  it("writes rendered HTML only after the authenticated request succeeds", async () => {
    const writeHtml = vi.fn();
    const previewWindow = { close: vi.fn(), opener: {} } as unknown as Window;
    const result = await openHelpHubPreview(
      { document: { slug: "patterns-for-lk150", title: "Draft", status: "draft" } },
      {
        previewWindow,
        writeHtml,
        fetchHtml: async () => ({
          ok: true,
          status: 200,
          html: "<html><body>Help Hub preview</body></html>",
        }),
      },
    );
    expect(result.ok).toBe(true);
    expect(writeHtml).toHaveBeenCalledTimes(1);
    expect(writeHtml.mock.calls[0]?.[1]).toContain("Help Hub preview");
    expect(previewWindow.close).not.toHaveBeenCalled();
  });

  it("does not open HTML when unauthorized", async () => {
    const writeHtml = vi.fn();
    const previewWindow = { close: vi.fn(), opener: {} } as unknown as Window;
    const result = await openHelpHubPreview(
      { slug: "patterns-for-lk150" },
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
