import { describe, expect, it } from "vitest";

import {
  MAX_CONTACT_IMAGE_BYTES,
  MAX_CONTACT_IMAGES,
  contactImageCountError,
  contactImageTooLargeError,
  contactImageTotalError,
  contactImageTypeError,
  mergeContactImageSelection,
  validateContactImageBatch,
  type ContactImageLike,
} from "./contactImages";

function image(
  name: string,
  size: number,
  type = "image/jpeg",
  lastModified = 1,
): ContactImageLike {
  return { name, size, type, lastModified };
}

describe("contact image selection", () => {
  it("keeps one image, several images, and a submission with no images", () => {
    expect(validateContactImageBatch([]).ok).toBe(true);
    expect(validateContactImageBatch([image("one.jpg", 120)]).images).toHaveLength(1);
    const many = Array.from({ length: MAX_CONTACT_IMAGES }, (_, index) =>
      image(`photo-${index}.png`, 100, "image/png", index),
    );
    expect(validateContactImageBatch(many).images).toHaveLength(MAX_CONTACT_IMAGES);
  });

  it("adds images from a later selection without dropping earlier ones", () => {
    const first = mergeContactImageSelection(
      [],
      [image("gauge.jpg", 10, "image/jpeg", 1), image("carriage.png", 20, "image/png", 2)],
    );
    const second = mergeContactImageSelection(first.files, [
      image("hem.webp", 30, "image/webp", 3),
    ]);

    expect(second.error).toBeNull();
    expect(second.files.map((file) => file.name)).toEqual([
      "gauge.jpg",
      "carriage.png",
      "hem.webp",
    ]);
  });

  it("does not add the same file twice", () => {
    const original = image("gauge.jpg", 10, "image/jpeg", 4);
    const merged = mergeContactImageSelection([original], [original]);
    expect(merged.error).toBeNull();
    expect(merged.files).toEqual([original]);
  });

  it("rejects a sixth image and keeps the five already chosen", () => {
    const current = Array.from({ length: MAX_CONTACT_IMAGES }, (_, index) =>
      image(`photo-${index}.jpg`, 10, "image/jpeg", index),
    );
    const merged = mergeContactImageSelection(current, [image("extra.jpg", 10, "image/jpeg", 99)]);
    expect(merged.files).toHaveLength(MAX_CONTACT_IMAGES);
    expect(merged.error).toBe(contactImageCountError());
    expect(validateContactImageBatch([...current, image("extra.jpg", 10)]).ok).toBe(false);
  });

  it("rejects a file that is over the per-image limit and keeps the rest", () => {
    const kept = image("ok.jpg", 100);
    const merged = mergeContactImageSelection(
      [kept],
      [image("huge.jpg", MAX_CONTACT_IMAGE_BYTES + 1, "image/jpeg", 2)],
    );
    expect(merged.files).toEqual([kept]);
    expect(merged.error).toBe(contactImageTooLargeError());
  });

  it("rejects files that would push the total over 4MB and keeps earlier files", () => {
    const kept = image("first.jpg", MAX_CONTACT_IMAGE_BYTES - 50);
    const merged = mergeContactImageSelection(
      [kept],
      [image("second.jpg", 100, "image/jpeg", 2)],
    );
    expect(merged.files).toEqual([kept]);
    expect(merged.error).toBe(contactImageTotalError());
  });

  it("rejects a file type the form does not accept", () => {
    const merged = mergeContactImageSelection(
      [image("ok.jpg", 10)],
      [image("notes.gif", 10, "image/gif", 2)],
    );
    expect(merged.files.map((file) => file.name)).toEqual(["ok.jpg"]);
    expect(merged.error).toBe(contactImageTypeError());
    expect(validateContactImageBatch([image("notes.gif", 10, "image/gif")]).ok).toBe(false);
  });
});
