import { describe, expect, it } from "vitest";

import { isContactUploadKey } from "./contactUploads";

describe("contact upload keys", () => {
  it("accepts only contact image keys", () => {
    expect(isContactUploadKey("contact/11111111-1111-4111-8111-111111111111.jpg")).toBe(true);
    expect(isContactUploadKey(" contact/11111111-1111-4111-8111-111111111111.png ")).toBe(
      true,
    );
    expect(isContactUploadKey("contact/not-a-uuid.jpg")).toBe(false);
    expect(isContactUploadKey("../contact/11111111-1111-4111-8111-111111111111.jpg")).toBe(
      false,
    );
    expect(isContactUploadKey("")).toBe(false);
  });
});
