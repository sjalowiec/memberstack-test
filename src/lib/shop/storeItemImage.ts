import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import {
  decodeImageDataBase64,
  type ImageUploadInput,
} from "../machines/machineSalesImageUpload";

export const STORE_ITEM_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type StoreItemImageKind = "cable" | "ebook" | "download";

const IMAGE_DIRS: Record<StoreItemImageKind, { disk: string; url: string }> = {
  cable: { disk: path.join("images", "shop", "designaknit"), url: "/images/shop/designaknit/" },
  ebook: { disk: path.join("store", "thumbnails"), url: "/store/thumbnails/" },
  download: { disk: path.join("images", "shop", "downloads"), url: "/images/shop/downloads/" },
};

function sniffImage(bytes: Buffer): keyof typeof IMAGE_TYPES | null {
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
  return null;
}

export function sanitizeStoreItemImageFilename(original: string, extension: string): string {
  const base = original
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "store-item"}.${extension}`;
}

function uniqueFilename(directory: string, filename: string): string {
  if (!existsSync(path.join(directory, filename))) return filename;
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  return `${stem}-${Date.now()}${ext}`;
}

/**
 * Save a shop image the same way Machines for Sale does: JPG, PNG, or WebP
 * written under public/ so the existing shop pages can load it by path.
 */
export const STORE_ITEM_IMAGE_STORE = "store-item-images";
export const STORE_ITEM_MEDIA_PREFIX = "/media/store-items/";

const STORED_IMAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|png|webp)$/;

export function isStoreItemImageFilename(value: string): boolean {
  return STORED_IMAGE_NAME.test(value.trim());
}

export type StoreItemImageBlob = {
  exists(filename: string): Promise<boolean>;
  write(filename: string, bytes: Buffer, contentType: string): Promise<void>;
  read(filename: string): Promise<{ bytes: ArrayBuffer; contentType: string | null } | null>;
};

export function netlifyStoreItemImageBlob(): StoreItemImageBlob {
  const store = getStore({
    name: STORE_ITEM_IMAGE_STORE,
    consistency: "strong",
  });
  return {
    async exists(filename) {
      const current = await store.getMetadata(filename);
      return current != null;
    },
    async write(filename, bytes, contentType) {
      await store.set(filename, bytes, { metadata: { contentType } });
    },
    async read(filename) {
      const entry = await store.getWithMetadata(filename, { type: "arrayBuffer" });
      if (!entry) return null;
      const contentType = entry.metadata?.contentType;
      return {
        bytes: entry.data,
        contentType: typeof contentType === "string" ? contentType : null,
      };
    },
  };
}

function suffixedImageFilename(filename: string, n: number): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  return `${stem}-${n}${ext}`;
}

/**
 * Keep a hosted shop image in the site's blob store and serve it from
 * /media/store-items/, the same kind of public media route Help Hub uses.
 */
export async function saveStoreItemImageBlob(
  input: ImageUploadInput,
  blob: StoreItemImageBlob,
): Promise<{ filename: string; url: string }> {
  const sniffed = prepareStoreItemImage(input);
  let filename = sniffed.filename;
  let stored = false;
  for (let attempt = 2; attempt <= 21; attempt += 1) {
    if (!(await blob.exists(filename))) {
      stored = true;
      break;
    }
    if (attempt === 21) break;
    filename = suffixedImageFilename(sniffed.filename, attempt);
  }
  if (!stored) throw new Error("Could not choose a unique image name.");
  if (!isStoreItemImageFilename(filename)) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  await blob.write(filename, sniffed.bytes, sniffed.contentType);
  return { filename, url: `${STORE_ITEM_MEDIA_PREFIX}${filename}` };
}

function prepareStoreItemImage(input: ImageUploadInput): {
  filename: string;
  contentType: keyof typeof IMAGE_TYPES;
  bytes: Buffer;
} {
  const declared = input.mimeType.trim().toLowerCase();
  if (!(declared in IMAGE_TYPES) && declared !== "") {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  const bytes = decodeImageDataBase64(input.dataBase64);
  if (bytes.length === 0) throw new Error("Image data is empty.");
  if (bytes.length > STORE_ITEM_IMAGE_MAX_BYTES) {
    throw new Error("Image is too large. Please use a file under 6 MB.");
  }
  const sniffed = sniffImage(bytes);
  if (!sniffed) throw new Error("Image must be a JPG, PNG, or WebP file.");
  if (declared && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg")) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  return {
    filename: sanitizeStoreItemImageFilename(input.filename, IMAGE_TYPES[sniffed]),
    contentType: sniffed,
    bytes,
  };
}

export function saveStoreItemImage(
  kind: StoreItemImageKind,
  input: ImageUploadInput,
  options: { publicDir?: string } = {},
): { filename: string; url: string } {
  const folder = IMAGE_DIRS[kind];
  if (!folder) {
    throw new Error("This product type does not have a shop image.");
  }

  const declared = input.mimeType.trim().toLowerCase();
  if (!(declared in IMAGE_TYPES) && declared !== "") {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }

  const bytes = decodeImageDataBase64(input.dataBase64);
  if (bytes.length > STORE_ITEM_IMAGE_MAX_BYTES) {
    throw new Error("Image is too large. Please use a file under 6 MB.");
  }
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }
  if (declared && declared !== sniffed && !(declared === "image/jpg" && sniffed === "image/jpeg")) {
    throw new Error("Image must be a JPG, PNG, or WebP file.");
  }

  const extension = IMAGE_TYPES[sniffed];
  const directory = path.join(options.publicDir ?? path.join(process.cwd(), "public"), folder.disk);
  mkdirSync(directory, { recursive: true });
  const filename = uniqueFilename(directory, sanitizeStoreItemImageFilename(input.filename, extension));
  writeFileSync(path.join(directory, filename), bytes);
  return { filename, url: `${folder.url}${filename}` };
}
