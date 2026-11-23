import { describe, expect, it } from "vitest";
import { publicVimeoPlayerUrl } from "./publicVimeoPlayerUrl";

describe("public Vimeo player URL", () => {
  it("keeps the existing player URL when no extra options are set", () => {
    expect(publicVimeoPlayerUrl({ vimeoId: "1249450856" })).toBe(
      "https://player.vimeo.com/video/1249450856?byline=0&portrait=0",
    );
  });

  it("leaves autoplay off and can show controls without a privacy hash", () => {
    const url = publicVimeoPlayerUrl({
      vimeoId: "1249450856",
      autoplay: false,
      controls: true,
      showPlayerTitle: false,
    });
    expect(url).toBe(
      "https://player.vimeo.com/video/1249450856?byline=0&portrait=0&controls=1&title=0",
    );
    expect(url).not.toContain("autoplay");
  });

  it("adds a privacy hash only when it is letters and digits", () => {
    expect(
      publicVimeoPlayerUrl({
        vimeoId: "1249450856",
        privacyHash: "Ab12cd",
        controls: true,
      }),
    ).toContain("h=Ab12cd");
    expect(publicVimeoPlayerUrl({ vimeoId: "1249450856", privacyHash: "bad hash" })).not.toContain(
      "h=",
    );
  });
});
