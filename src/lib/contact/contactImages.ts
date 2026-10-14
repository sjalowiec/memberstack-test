/**
 * Contact photo limits shared by the form and the contact function.
 *
 * Netlify synchronous functions accept a 6MB buffered payload. Binary uploads
 * are Base64-encoded, which adds about 30% and leaves roughly 4.5MB for the
 * file bytes. A 4MB total leaves room for the rest of the multipart form.
 * Resend allows 40MB per email after Base64 encoding, so this total also fits
 * when every image is attached.
 */
export const CONTACT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const CONTACT_IMAGE_ACCEPT = CONTACT_IMAGE_TYPES.join(",");
export const MAX_CONTACT_IMAGES = 5;
export const MAX_CONTACT_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CONTACT_IMAGES_TOTAL_BYTES = MAX_CONTACT_IMAGE_BYTES;

const CONTACT_IMAGE_TYPE_SET = new Set<string>(CONTACT_IMAGE_TYPES);

export const CONTACT_IMAGE_LIMIT_NOTE = `JPG, PNG, or WEBP • up to ${MAX_CONTACT_IMAGES} images • 4MB total`;

export type ContactImageLike = {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
};

export function contactImageTypeError(): string {
  return "Please choose a JPG, PNG, or WEBP image.";
}

export function contactImageTooLargeError(): string {
  return "Please choose an image smaller than 4MB.";
}

export function contactImageCountError(): string {
  return `You can attach up to ${MAX_CONTACT_IMAGES} images.`;
}

export function contactImageTotalError(): string {
  return "Please keep all images under 4MB combined.";
}

function isAllowedContactImageType(type: string): boolean {
  return CONTACT_IMAGE_TYPE_SET.has(type);
}

function isSameContactImage(a: ContactImageLike, b: ContactImageLike): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.size === b.size &&
    a.lastModified === b.lastModified
  );
}

/**
 * Reject a submitted batch. One invalid image rejects the whole submission.
 */
export function validateContactImageBatch<T extends ContactImageLike>(
  files: readonly T[],
): { ok: true; images: T[] } | { ok: false; error: string } {
  if (files.length > MAX_CONTACT_IMAGES) {
    return { ok: false, error: contactImageCountError() };
  }

  let total = 0;
  for (const file of files) {
    if (!isAllowedContactImageType(file.type)) {
      return { ok: false, error: contactImageTypeError() };
    }
    if (file.size > MAX_CONTACT_IMAGE_BYTES) {
      return { ok: false, error: contactImageTooLargeError() };
    }
    total += file.size;
    if (total > MAX_CONTACT_IMAGES_TOTAL_BYTES) {
      return { ok: false, error: contactImageTotalError() };
    }
  }

  return { ok: true, images: [...files] };
}

/**
 * Add newly chosen files to images the customer already selected.
 * Valid files are kept. The first problem is reported and nothing already
 * accepted is dropped.
 */
export function mergeContactImageSelection<T extends ContactImageLike>(
  current: readonly T[],
  incoming: readonly T[],
): { files: T[]; error: string | null } {
  const files = [...current];
  let error: string | null = null;

  const remember = (message: string) => {
    if (!error) error = message;
  };

  for (const file of incoming) {
    if (file.size === 0) continue;
    if (files.some((existing) => isSameContactImage(existing, file))) continue;

    if (files.length >= MAX_CONTACT_IMAGES) {
      remember(contactImageCountError());
      break;
    }
    if (!isAllowedContactImageType(file.type)) {
      remember(contactImageTypeError());
      continue;
    }
    if (file.size > MAX_CONTACT_IMAGE_BYTES) {
      remember(contactImageTooLargeError());
      continue;
    }
    const total = files.reduce((sum, item) => sum + item.size, 0) + file.size;
    if (total > MAX_CONTACT_IMAGES_TOTAL_BYTES) {
      remember(contactImageTotalError());
      continue;
    }
    files.push(file);
  }

  return { files, error };
}
