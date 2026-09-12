import {
  fetchAdminHtml,
  htmlLooksLikeAdminPreviewBootstrap,
} from "../lib/admin/adminAuthClient";

/**
 * Unpublished-course `?preview=true` GET has no Authorization header. After
 * Memberstack is ready, re-request the same URL with the session JWT — the same
 * pattern Help Hub and member-lesson admin previews use. Query string alone never
 * unlocks content.
 */
export async function runKinCourseAdminPreviewBootstrap(
  options: {
    href?: string;
    fetchHtml?: typeof fetchAdminHtml;
    writeHtml?: (html: string) => void;
  } = {},
): Promise<boolean> {
  const href =
    options.href ??
    (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "");
  if (!href) return false;
  const url = new URL(href, "https://www.knititnow.com");
  if (url.searchParams.get("preview") !== "true") return false;

  const fetchHtml = options.fetchHtml ?? fetchAdminHtml;
  const result = await fetchHtml(href, { method: "GET" });
  if (!result.ok || !result.html) return false;
  if (htmlLooksLikeAdminPreviewBootstrap(result.html)) return false;

  const writeHtml =
    options.writeHtml ??
    ((html: string) => {
      document.open();
      document.write(html);
      document.close();
    });
  writeHtml(result.html);
  return true;
}
