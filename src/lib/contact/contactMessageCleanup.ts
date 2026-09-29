import { deleteContactUpload } from "./contactUploads";

export async function deleteContactMessageAttachments(
  blobKeys: Array<string | null | undefined>,
): Promise<void> {
  for (const blobKey of blobKeys) {
    if (!blobKey) continue;
    try {
      const removed = await deleteContactUpload(blobKey);
      if (!removed) {
        console.error("[watson] Contact attachment was not deleted with the message.");
      }
    } catch (error) {
      console.error(
        "[watson] Contact attachment delete failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
}
