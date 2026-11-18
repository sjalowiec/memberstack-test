import { describe, expect, it } from "vitest";
import { helpHubImageUploadProblem } from "./imagePolicy";
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
    expect(helpHubImagePublicPath(prepared.filename)).toBe("/media/help-hub/double-high.png");
    expect(isHelpHubImageFilename("double_high.png")).toBe(true);
    expect(isHelpHubImageFilename("../secret.png")).toBe(false);
  });

  it("rejects a file that is not a JPG, PNG, WebP, or GIF", () => {
    expect(() =>
      prepareHelpHubImageUpload({
        filename: "notes.svg",
        mimeType: "image/svg+xml",
        dataBase64: Buffer.from("<svg></svg>").toString("base64"),
      }),
    ).toThrow(/JPG, PNG, WebP, or GIF/);
  });

  it("stores a GIF byte for byte so an animation is not flattened", () => {
    const gif = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64",
    );
    const prepared = prepareHelpHubImageUpload({
      filename: "Needle Bounce.GIF",
      mimeType: "image/gif",
      dataBase64: gif.toString("base64"),
    });
    expect(prepared.contentType).toBe("image/gif");
    expect(prepared.filename).toBe("needle-bounce.gif");
    expect(prepared.bytes.equals(gif)).toBe(true);
    expect(sniffHelpHubImage(prepared.bytes)).toBe("image/gif");
    expect(isHelpHubImageFilename(prepared.filename)).toBe(true);
  });

  it("explains a file that is too large or the wrong type before upload", () => {
    expect(
      helpHubImageUploadProblem(
        { name: "loop.gif", type: "image/gif", size: 4 * 1024 * 1024 + 1 },
        { allowGif: true },
      ),
    ).toMatch(/under 4 MB/);
    expect(
      helpHubImageUploadProblem({ name: "notes.svg", type: "image/svg+xml", size: 20 }, { allowGif: true }),
    ).toMatch(/JPG, PNG, WebP, or GIF/);
    expect(
      helpHubImageUploadProblem({ name: "loop.gif", type: "image/gif", size: 20 }, { allowGif: false }),
    ).toMatch(/JPG, PNG, or WebP/);
    expect(
      helpHubImageUploadProblem({ name: "loop.gif", type: "image/gif", size: 20 }, { allowGif: true }),
    ).toBeNull();
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
      url: "/media/help-hub/double-high-2.png",
    });
    expect(sanitizeHelpHubImageFilename("My Photo", "image/jpeg")).toBe("my-photo.jpg");
  });
});
