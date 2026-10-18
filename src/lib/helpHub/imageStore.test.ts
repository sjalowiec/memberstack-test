import { describe, expect, it } from "vitest";
import {
  helpHubImagePublicPath,
  isHelpHubImageFilename,
  prepareHelpHubImageUpload,
  sanitizeHelpHubImageFilename,
  saveHelpHubImage,
  sniffHelpHubImage,
} from "./imageStore";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Help Hub image uploads", () => {
  it("accepts a PNG and builds a site path", () => {
    const prepared = prepareHelpHubImageUpload({
      filename: "Double High.PNG",
      mimeType: "image/png",
      dataBase64: TINY_PNG,
    });
    expect(prepared.contentType).toBe("image/png");
    expect(prepared.filename).toBe("double-high.png");
    expect(sniffHelpHubImage(prepared.bytes)).toBe("image/png");
    expect(helpHubImagePublicPath(prepared.filename)).toBe("/images/help-hub/double-high.png");
    expect(isHelpHubImageFilename("double_high.png")).toBe(true);
    expect(isHelpHubImageFilename("../secret.png")).toBe(false);
  });

  it("rejects a file that is not a JPG, PNG, or WebP", () => {
    expect(() =>
      prepareHelpHubImageUpload({
        filename: "notes.svg",
        mimeType: "image/svg+xml",
        dataBase64: Buffer.from("<svg></svg>").toString("base64"),
      }),
    ).toThrow(/JPG, PNG, or WebP/);
  });

  it("stores a new name when that filename is already used", async () => {
    const stored = new Set<string>(["double-high.png"]);
    const saved = await saveHelpHubImage(
      { filename: "double-high.png", mimeType: "image/png", dataBase64: TINY_PNG },
      async (sql, params = []) => {
        if (sql.startsWith("SELECT")) {
          const filename = String(params[0]);
          return stored.has(filename)
            ? [{ filename, content_type: "image/png", bytes: Buffer.from("old") }]
            : [];
        }
        stored.add(String(params[0]));
        return [];
      },
    );
    expect(saved).toEqual({
      filename: "double-high-2.png",
      url: "/images/help-hub/double-high-2.png",
    });
    expect(sanitizeHelpHubImageFilename("My Photo", "image/jpeg")).toBe("my-photo.jpg");
  });
});
