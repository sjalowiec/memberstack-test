import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_OPEN_PATTERN_HREF,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";
import {
  buildPatternReviewLegacyRedirect,
  DROP_SHOULDER_REVIEW_LEGACY_PATH,
  SLEEVELESS_REVIEW_LEGACY_PATH,
} from "./patternReviewLegacyRedirect";

describe("buildPatternReviewLegacyRedirect", () => {
  it("redirects sleeveless review to the workspace with generated=1", () => {
    expect(
      buildPatternReviewLegacyRedirect(
        "https://example.test/patterns/sleeveless/review/",
        OPEN_PATTERN_HREF,
      ),
    ).toBe("/patterns/sleeveless/pattern/?generated=1");
  });

  it("redirects drop-shoulder review to the drop-shoulder workspace", () => {
    expect(
      buildPatternReviewLegacyRedirect(
        "https://example.test/patterns/drop-shoulder/review/",
        DROP_SHOULDER_OPEN_PATTERN_HREF,
      ),
    ).toBe("/patterns/drop-shoulder/pattern/?generated=1");
  });

  it("preserves existing query params and adds generated=1", () => {
    expect(
      buildPatternReviewLegacyRedirect(
        "https://example.test/patterns/sleeveless/review/?express=1&who=women&selectedSize=M",
        OPEN_PATTERN_HREF,
      ),
    ).toBe("/patterns/sleeveless/pattern/?express=1&who=women&selectedSize=M&generated=1");
  });

  it("does not duplicate generated=1 when already present", () => {
    expect(
      buildPatternReviewLegacyRedirect(
        "https://example.test/patterns/sleeveless/review/?generated=1&tab=pattern",
        OPEN_PATTERN_HREF,
      ),
    ).toBe("/patterns/sleeveless/pattern/?generated=1&tab=pattern");
  });

  it("documents legacy review paths for route tests", () => {
    expect(SLEEVELESS_REVIEW_LEGACY_PATH).toBe("/patterns/sleeveless/review");
    expect(DROP_SHOULDER_REVIEW_LEGACY_PATH).toBe("/patterns/drop-shoulder/review");
  });
});
