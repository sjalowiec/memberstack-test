import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MACHINE_SALES_IMAGE_DIR, MACHINE_SALES_IMAGE_DISK_DIR } from "./machineSalesListings";

export const MACHINE_SALES_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

export const MACHINE_SALES_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageUploadInput = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

function extFromMime(mimeType: string): string | null {
  return MACHINE_SALES_UPLOAD_TYPES[mimeType.trim().toLowerCase()] ?? null;
}

export function sanitizeMachineSalesUploadFilename(original: string, mimeType: string): string {
  const ext = extFromMime(mimeType);
  if (!ext) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  const base = original
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "machine-sale"}.${ext}`;
}

export function decodeImageDataBase64(dataBase64: string): Buffer {
  const trimmed = dataBase64.trim();
  const comma = trimmed.indexOf(",");
  const payload = trimmed.startsWith("data:") && comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length === 0) {
    throw new Error("Image data is empty.");
  }
  if (buffer.length > MACHINE_SALES_UPLOAD_MAX_BYTES) {
    throw new Error("Image is too large. Please use a file under 6 MB.");
  }
  return buffer;
}

export function uniqueMachineSalesImageFilename(filename: string): string {
  const diskPath = path.join(MACHINE_SALES_IMAGE_DISK_DIR, filename);
  if (!existsSync(diskPath)) return filename;
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  return `${stem}-${Date.now()}${ext}`;
}

export function writeMachineSalesImage(input: ImageUploadInput): { filename: string; imageSrc: string } {
  const mime = input.mimeType.trim().toLowerCase();
  if (!extFromMime(mime)) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  const safeName = uniqueMachineSalesImageFilename(
    sanitizeMachineSalesUploadFilename(input.filename, mime)
  );
  const buffer = decodeImageDataBase64(input.dataBase64);
  mkdirSync(MACHINE_SALES_IMAGE_DISK_DIR, { recursive: true });
  writeFileSync(path.join(MACHINE_SALES_IMAGE_DISK_DIR, safeName), buffer);
  return {
    filename: safeName,
    imageSrc: `${MACHINE_SALES_IMAGE_DIR}${encodeURIComponent(safeName)}`,
  };
}
