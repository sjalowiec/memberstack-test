import type { APIRoute } from "astro";
import { readHelpHubImage } from "../../../lib/helpHub/imageStore";

export const prerender = false;

/** Public image bytes for a Help Hub upload. Draft text stays private; the file address is not listed. */
export const GET: APIRoute = async ({ params }) => {
  const filename = typeof params.file === "string" ? params.file : "";
  const image = await readHelpHubImage(filename);
  if (!image) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
