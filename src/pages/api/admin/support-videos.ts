import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../lib/admin/requireAdminRequest";
import { customerHelpAdminRows } from "../../../lib/supportVideos/customerHelpVideoCatalog";
import {
  createCustomerHelpVideo,
  customerHelpBlobForRuntime,
  readCustomerHelpCatalog,
} from "../../../lib/supportVideos/customerHelpVideoStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  const read = await readCustomerHelpCatalog(customerHelpBlobForRuntime());
  if (!read.ok) return json({ ok: false, error: read.error }, 500);
  return json({ ok: true, videos: customerHelpAdminRows(read.catalog) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const saved = await createCustomerHelpVideo(customerHelpBlobForRuntime(), {
    title: record.title,
    vimeoUrl: record.vimeoUrl,
    message: record.message,
  });
  if (!saved.ok) return json({ ok: false, error: saved.error }, 400);
  return json(
    {
      ok: true,
      created: saved.created,
      changed: saved.changed,
      video: {
        slug: saved.video.slug,
        title: saved.video.title,
        vimeoId: saved.video.vimeoId,
        path: saved.path,
        unlisted: Boolean(saved.video.privacyHash),
      },
    },
    saved.created ? 201 : 200,
  );
};
