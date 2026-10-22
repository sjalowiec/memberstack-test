import { beforeEach, describe, expect, it, vi } from "vitest";

const readHelpHubImage = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/helpHub/imageStore", () => ({
  readHelpHubImage,
}));

import { GET } from "./[file]";

describe("Help Hub uploaded image route", () => {
  beforeEach(() => {
    readHelpHubImage.mockReset();
  });

  it("serves stored PNG bytes without an admin check", async () => {
    readHelpHubImage.mockResolvedValue({
      filename: "double_high.png",
      contentType: "image/png",
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    const response = await GET({ params: { file: "double_high.png" } } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(readHelpHubImage).toHaveBeenCalledWith("double_high.png");
  });

  it("does not serve an unknown file", async () => {
    readHelpHubImage.mockResolvedValue(null);
    const response = await GET({ params: { file: "missing.png" } } as never);
    expect(response.status).toBe(404);
  });
});
