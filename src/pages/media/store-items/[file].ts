import type { APIRoute } from "astro";
import {
  isStoreItemImageFilename,
  netlifyStoreItemImageBlob,
} from "../../../lib/shop/storeItemImage";

export const prerender = false;

/** Public bytes for a shop image uploaded on this Netlify site. */
export const GET: APIRoute = async ({ params }) => {
  const filename = typeof params.file === "string" ? params.file : "";
  if (!isStoreItemImageFilename(filename)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const image = await netlifyStoreItemImageBlob().read(filename);
    if (!image) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const contentType =
      image.contentType === "image/png" ||
      image.contentType === "image/jpeg" ||
      image.contentType === "image/webp"
        ? image.contentType
        : null;
    if (!contentType) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(image.bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
};
