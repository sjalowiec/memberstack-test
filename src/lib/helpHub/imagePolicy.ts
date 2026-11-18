/** Shared by the admin upload check and the server store. GIFs are not re-encoded. */
export const HELP_HUB_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export const HELP_HUB_IMAGE_SIZE_ERROR = "Image is too large. Please use a file under 4 MB.";

export const HELP_HUB_IMAGE_TYPE_ERROR = "Image must be a JPG, PNG, WebP, or GIF file.";

export const HELP_HUB_STILL_IMAGE_TYPE_ERROR = "Image must be a JPG, PNG, or WebP file.";

export const HELP_HUB_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type HelpHubImageContentType = keyof typeof HELP_HUB_IMAGE_TYPES;

const STILL_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const STILL_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Client-side message before an upload starts.
 * The server sniffs the bytes again and is the source of truth.
 */
export function helpHubImageUploadProblem(
  file: { name: string; type: string; size: number },
  options: { allowGif: boolean },
): string | null {
  if (file.size > HELP_HUB_IMAGE_MAX_BYTES) return HELP_HUB_IMAGE_SIZE_ERROR;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type.trim().toLowerCase();
  const extensions = options.allowGif ? [...STILL_EXTENSIONS, "gif"] : STILL_EXTENSIONS;
  const types = options.allowGif ? [...STILL_TYPES, "image/gif"] : STILL_TYPES;
  const typeOk = type === "" || types.includes(type);
  const extOk = ext === "" || extensions.includes(ext);
  if (!typeOk || !extOk) {
    return options.allowGif ? HELP_HUB_IMAGE_TYPE_ERROR : HELP_HUB_STILL_IMAGE_TYPE_ERROR;
  }
  return null;
}
