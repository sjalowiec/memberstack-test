import { getStore } from "@netlify/blobs";

export const CONTACT_UPLOADS_STORE = "contact-uploads";

/** Keys created by contact.js: contact/{uuid}.{jpg|png|webp} */
const CONTACT_UPLOAD_KEY_PATTERN =
  /^contact\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isContactUploadKey(value: string): boolean {
  return CONTACT_UPLOAD_KEY_PATTERN.test(value.trim());
}

export async function deleteContactUpload(blobKey: string): Promise<boolean> {
  const key = blobKey.trim();
  if (!isContactUploadKey(key)) return false;
  const store = getStore({
    name: CONTACT_UPLOADS_STORE,
    consistency: "strong",
  });
  await store.delete(key);
  return true;
}
