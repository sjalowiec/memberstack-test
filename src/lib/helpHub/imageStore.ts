import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  HELP_HUB_IMAGE_MAX_BYTES,
  HELP_HUB_IMAGE_SIZE_ERROR,
  HELP_HUB_IMAGE_TYPE_ERROR,
  HELP_HUB_IMAGE_TYPES,
  type HelpHubImageContentType,
} from "./imagePolicy";

export {
  HELP_HUB_IMAGE_MAX_BYTES,
  HELP_HUB_IMAGE_SIZE_ERROR,
  HELP_HUB_IMAGE_TYPE_ERROR,
  HELP_HUB_IMAGE_TYPES,
};
export type { HelpHubImageContentType };

const FILENAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,60}\.(png|jpe?g|webp|gif)$/;

export type HelpHubImageUploadInput = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

export type PreparedHelpHubImage = {
  filename: string;
  contentType: HelpHubImageContentType;
  bytes: Buffer;
};

export type HelpHubStoredImage = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

type ImageRow = {
  filename: string;
  content_type: string;
  bytes: Buffer | Uint8Array | string;
};

export function isHelpHubImageFilename(value: string): boolean {
  return FILENAME_PATTERN.test(value);
}

export function helpHubImagePublicPath(filename: string): string {
  return `/media/help-hub/${filename}`;
}

export function sniffHelpHubImage(bytes: Buffer): HelpHubImageContentType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6) {
    const signature = bytes.toString("ascii", 0, 6);
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  return null;
}

export function sanitizeHelpHubImageFilename(original: string, contentType: HelpHubImageContentType): string {
  const ext = HELP_HUB_IMAGE_TYPES[contentType];
  const base = original
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "help-hub"}.${ext}`;
}

function decodeBase64(dataBase64: string): Buffer {
  const trimmed = dataBase64.trim();
  const comma = trimmed.indexOf(",");
  const payload = trimmed.startsWith("data:") && comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  return Buffer.from(payload, "base64");
}

export function prepareHelpHubImageUpload(input: HelpHubImageUploadInput): PreparedHelpHubImage {
  const bytes = decodeBase64(input.dataBase64);
  if (bytes.length === 0) {
    throw new Error("Image data is empty.");
  }
  if (bytes.length > HELP_HUB_IMAGE_MAX_BYTES) {
    throw new Error(HELP_HUB_IMAGE_SIZE_ERROR);
  }
  const contentType = sniffHelpHubImage(bytes);
  if (!contentType) {
    throw new Error(HELP_HUB_IMAGE_TYPE_ERROR);
  }
  const declared = input.mimeType.trim().toLowerCase();
  if (declared && declared !== contentType && declared !== "image/jpg") {
    throw new Error(HELP_HUB_IMAGE_TYPE_ERROR);
  }
  if (declared === "image/jpg" && contentType !== "image/jpeg") {
    throw new Error(HELP_HUB_IMAGE_TYPE_ERROR);
  }
  return {
    filename: sanitizeHelpHubImageFilename(input.filename, contentType),
    contentType,
    bytes,
  };
}

function suffixedFilename(filename: string, n: number): string {
  const dot = filename.lastIndexOf(".");
  const stem = filename.slice(0, dot);
  const ext = filename.slice(dot);
  return `${stem}-${n}${ext}`;
}

function asBuffer(value: ImageRow["bytes"]): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  return Buffer.from(value);
}

export async function readHelpHubImage(
  filename: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubStoredImage | null> {
  if (!isHelpHubImageFilename(filename)) return null;
  const rows = await queryFn<ImageRow>(
    `SELECT filename, content_type, bytes FROM help_hub_images WHERE filename = $1`,
    [filename],
  );
  const row = rows[0];
  if (!row) return null;
  const contentType = row.content_type;
  if (!(contentType in HELP_HUB_IMAGE_TYPES)) {
    return null;
  }
  return { filename: row.filename, contentType, bytes: asBuffer(row.bytes) };
}

export async function saveHelpHubImage(
  input: HelpHubImageUploadInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<{ filename: string; url: string }> {
  const prepared = prepareHelpHubImageUpload(input);
  let filename = prepared.filename;
  for (let attempt = 2; attempt <= 20; attempt += 1) {
    const existing = await readHelpHubImage(filename, queryFn);
    if (!existing) break;
    filename = suffixedFilename(prepared.filename, attempt);
    if (attempt === 20) {
      throw new Error("Could not choose a unique image name.");
    }
  }
  await queryFn(
    `INSERT INTO help_hub_images (filename, content_type, bytes) VALUES ($1, $2, $3)`,
    [filename, prepared.contentType, prepared.bytes],
  );
  return { filename, url: helpHubImagePublicPath(filename) };
}
