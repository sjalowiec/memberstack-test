import { describe, expect, it } from "vitest";
import {
  SLEEVELESS_FRONT_STS_ROWS_PREVIEW_PATH,
  isSleevelessFrontStsRowsPreviewProductionBlocked,
  isSleevelessFrontStsRowsPreviewRoute,
} from "./sleevelessFrontStsRowsPreviewAccess";

describe("isSleevelessFrontStsRowsPreviewRoute", () => {
  it("matches the preview path with or without a trailing slash", () => {
    expect(isSleevelessFrontStsRowsPreviewRoute(SLEEVELESS_FRONT_STS_ROWS_PREVIEW_PATH)).toBe(true);
    expect(isSleevelessFrontStsRowsPreviewRoute(`${SLEEVELESS_FRONT_STS_ROWS_PREVIEW_PATH}/`)).toBe(
      true,
    );
  });

  it("does not match other routes", () => {
    expect(isSleevelessFrontStsRowsPreviewRoute("/dev/drop-shoulder-diagram-review")).toBe(false);
    expect(isSleevelessFrontStsRowsPreviewRoute("/patterns/sleeveless/pattern/")).toBe(false);
    expect(
      isSleevelessFrontStsRowsPreviewRoute("/dev/sleeveless-front-sts-rows-preview-extra"),
    ).toBe(false);
  });
});

describe("isSleevelessFrontStsRowsPreviewProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isSleevelessFrontStsRowsPreviewProductionBlocked("knititnow.com")).toBe(true);
    expect(isSleevelessFrontStsRowsPreviewProductionBlocked("www.knititnow.com")).toBe(true);
  });

  it("allows localhost and Astro dev", () => {
    expect(isSleevelessFrontStsRowsPreviewProductionBlocked("localhost", { isViteDev: true })).toBe(
      false,
    );
    expect(isSleevelessFrontStsRowsPreviewProductionBlocked("127.0.0.1")).toBe(false);
  });
});
