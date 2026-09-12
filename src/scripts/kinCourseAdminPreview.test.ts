import { describe, expect, it, vi } from "vitest";

import { runKinCourseAdminPreviewBootstrap } from "./kinCourseAdminPreview";

describe("kinCourseAdminPreview bootstrap", () => {
  it("re-requests preview URLs with the authenticated admin HTML fetch", async () => {
    const fetchHtml = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      html: "<html><body>Course 86</body></html>",
    }));
    const writeHtml = vi.fn();
    const replaced = await runKinCourseAdminPreviewBootstrap({
      href: "/courses/86?preview=true",
      fetchHtml,
      writeHtml,
    });
    expect(replaced).toBe(true);
    expect(fetchHtml).toHaveBeenCalledWith("/courses/86?preview=true", { method: "GET" });
    expect(writeHtml).toHaveBeenCalledWith("<html><body>Course 86</body></html>");
  });

  it("does not unlock content from the query string when auth HTML is denied", async () => {
    const fetchHtml = vi.fn(async () => ({
      ok: false as const,
      status: 404,
      error: "Course not found",
    }));
    const writeHtml = vi.fn();
    const replaced = await runKinCourseAdminPreviewBootstrap({
      href: "/courses/86?preview=true",
      fetchHtml,
      writeHtml,
    });
    expect(replaced).toBe(false);
    expect(writeHtml).not.toHaveBeenCalled();
  });

  it("does not replace the 404 shell with another bootstrap page", async () => {
    const fetchHtml = vi.fn(async () => ({
      ok: true as const,
      status: 200,
      html: '<body data-kin-admin-preview-bootstrap><p>Course not found</p></body>',
    }));
    const writeHtml = vi.fn();
    const replaced = await runKinCourseAdminPreviewBootstrap({
      href: "/courses/86/lesson/4212?preview=true",
      fetchHtml,
      writeHtml,
    });
    expect(replaced).toBe(false);
    expect(writeHtml).not.toHaveBeenCalled();
  });
});
