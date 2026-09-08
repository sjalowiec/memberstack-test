import { describe, expect, it, vi } from "vitest";

import {
  parseHelpHubPreviewBody,
  resolveHelpHubPreviewTip,
  helpHubPreviewUrlExposesDocument,
  helpHubPreviewBaseHref,
  htmlWithHelpHubPreviewBase,
  collectPreviewStylesheetHrefs,
  previewAssetAbsoluteUrl,
  previewAssetResolvesToSiteOrigin,
  HELP_HUB_PREVIEW_PATH,
} from "./previewDocument";

const KIN_DEV_ORIGIN = "https://kin-dev.netlify.app";

/** Realistic Astro SSR output for a Help Hub page (Layout + HelpHubTipPage). */
const ASTRO_HELP_HUB_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Help Hub preview</title>
    <link rel="stylesheet" href="/_astro/BaseLayout.Dxyz.css">
    <link rel="stylesheet" href="/_astro/HelpHubTipPage.Ab12.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <script type="module" src="/_astro/client.123.js"></script>
  </head>
  <body class="page--tight-header">
    <header><nav><a href="/help-hub">Help Hub</a></nav></header>
    <p class="help-hub-preview-banner">Preview — saved draft (not public)</p>
    <img src="/images/help-hub/try.jpg" alt="">
    <iframe src="https://player.vimeo.com/video/123" title="Vimeo"></iframe>
  </body>
</html>`;

describe("parseHelpHubPreviewBody", () => {
  it("renders unsaved editor fields from the posted document", () => {
    const parsed = parseHelpHubPreviewBody({
      document: {
        slug: "patterns-for-lk150",
        title: "Unsaved title",
        status: "draft",
        question: "Unsaved question",
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.mode === "document") {
      expect(parsed.tip.title).toBe("Unsaved title");
      expect(parsed.tip.slug).toBe("patterns-for-lk150");
      expect(parsed.tip.status).toBe("draft");
    }
  });

  it("accepts a saved slug without putting the document in a URL", () => {
    const parsed = parseHelpHubPreviewBody({ slug: "patterns-for-lk150" });
    expect(parsed).toEqual({ ok: true, mode: "slug", slug: "patterns-for-lk150" });
    expect(helpHubPreviewUrlExposesDocument(HELP_HUB_PREVIEW_PATH)).toBe(false);
    expect(helpHubPreviewUrlExposesDocument("/help-hub/preview?data=%7B%22title%22%3A%22x%22%7D")).toBe(
      true,
    );
  });
});

describe("resolveHelpHubPreviewTip", () => {
  it("does not load or persist when a document is posted", async () => {
    const loadBySlug = vi.fn();
    const result = await resolveHelpHubPreviewTip(
      {
        document: {
          slug: "patterns-for-lk150",
          title: "Edited in the form",
          status: "draft",
        },
      },
      loadBySlug,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tip.title).toBe("Edited in the form");
    expect(loadBySlug).not.toHaveBeenCalled();
  });

  it("loads a saved draft by slug and does not persist", async () => {
    const loadBySlug = vi.fn(async (slug: string) => ({
      slug,
      title: "Saved draft",
      status: "draft",
    }));
    const result = await resolveHelpHubPreviewTip({ slug: "patterns-for-lk150" }, loadBySlug);
    expect(result.ok).toBe(true);
    expect(loadBySlug).toHaveBeenCalledTimes(1);
    expect(loadBySlug).toHaveBeenCalledWith("patterns-for-lk150");
  });
});

describe("preview HTML asset origin", () => {
  it("injects an explicit site base so stylesheets resolve on kin-dev, not blob:", () => {
    const blobUrl = "blob:https://kin-dev.netlify.app/11111111-2222-3333-4444-555555555555";
    expect(() => new URL("/_astro/HelpHubTipPage.Ab12.css", blobUrl)).toThrow();
    expect(previewAssetResolvesToSiteOrigin("/_astro/HelpHubTipPage.Ab12.css", blobUrl)).toBe(false);

    const html = htmlWithHelpHubPreviewBase(ASTRO_HELP_HUB_HTML, KIN_DEV_ORIGIN);
    expect(html).toContain(`<base href="${KIN_DEV_ORIGIN}/">`);
    expect(html.indexOf("<base href=")).toBeLessThan(html.indexOf('href="/_astro/BaseLayout'));
    expect(html).toMatch(/<html/i);
    expect(html).toContain("page--tight-header");
    expect(html).not.toContain("blob:");

    const hrefs = collectPreviewStylesheetHrefs(html);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/_astro/BaseLayout.Dxyz.css",
        "/_astro/HelpHubTipPage.Ab12.css",
        "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap",
      ]),
    );
    for (const href of hrefs) {
      expect(previewAssetResolvesToSiteOrigin(href, KIN_DEV_ORIGIN)).toBe(true);
    }
    expect(previewAssetAbsoluteUrl("/_astro/HelpHubTipPage.Ab12.css", KIN_DEV_ORIGIN)).toBe(
      `${KIN_DEV_ORIGIN}/_astro/HelpHubTipPage.Ab12.css`,
    );
    expect(previewAssetAbsoluteUrl("/images/help-hub/try.jpg", KIN_DEV_ORIGIN)).toBe(
      `${KIN_DEV_ORIGIN}/images/help-hub/try.jpg`,
    );
    expect(previewAssetAbsoluteUrl("/_astro/client.123.js", KIN_DEV_ORIGIN)).toBe(
      `${KIN_DEV_ORIGIN}/_astro/client.123.js`,
    );
    expect(helpHubPreviewBaseHref(KIN_DEV_ORIGIN)).toBe(`${KIN_DEV_ORIGIN}/`);
    expect(helpHubPreviewBaseHref(blobUrl)).toBe("");
  });
});
