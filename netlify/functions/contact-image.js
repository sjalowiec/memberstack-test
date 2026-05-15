import { timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const CONTACT_UPLOADS_STORE = "contact-uploads";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Keys created by contact.js: contact/{uuid}.{jpg|png|webp} */
const BLOB_KEY_PATTERN =
  /^contact\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export default async (req) => {
  try {
    if (req.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim();
    const token = (url.searchParams.get("token") || "").trim();

    if (!id || !token || !BLOB_KEY_PATTERN.test(id)) {
      return notFound();
    }

    const store = getStore({
      name: CONTACT_UPLOADS_STORE,
      consistency: "strong",
    });

    const entry = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!entry) {
      return notFound();
    }

    const storedToken = entry.metadata?.accessToken;
    if (!secretTokensMatch(token, storedToken)) {
      return notFound();
    }

    const contentType = entry.metadata?.contentType;
    if (
      typeof contentType !== "string" ||
      !ALLOWED_IMAGE_TYPES.has(contentType)
    ) {
      return notFound();
    }

    return new Response(entry.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error in contact-image handler:", error);
    return notFound();
  }
};

function notFound() {
  return new Response("Not found", { status: 404 });
}

/**
 * @param {string} provided
 * @param {unknown} stored
 */
function secretTokensMatch(provided, stored) {
  if (typeof stored !== "string") {
    return false;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(stored, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
