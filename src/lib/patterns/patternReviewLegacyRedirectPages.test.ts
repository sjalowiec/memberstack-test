import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sleevelessReviewAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/review.astro"),
  "utf8",
);
const dropShoulderReviewAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/review.astro"),
  "utf8",
);
const expressMeasurementsAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless-express-measurements.astro"),
  "utf8",
);
const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);

describe("legacy review route redirects (Phase 2)", () => {
  it("sleeveless review.astro redirects via buildPatternReviewLegacyRedirect", () => {
    expect(sleevelessReviewAstro).toContain("buildPatternReviewLegacyRedirect");
    expect(sleevelessReviewAstro).toContain("OPEN_PATTERN_HREF");
    expect(sleevelessReviewAstro).not.toContain("sleeveless-builder-review-page");
  });

  it("drop-shoulder review.astro redirects via buildPatternReviewLegacyRedirect", () => {
    expect(dropShoulderReviewAstro).toContain("buildPatternReviewLegacyRedirect");
    expect(dropShoulderReviewAstro).toContain("DROP_SHOULDER_OPEN_PATTERN_HREF");
    expect(dropShoulderReviewAstro).not.toContain("sleeveless-builder-review-page");
  });

  it("legacy express-measurements URL redirects to the pattern workspace", () => {
    expect(expressMeasurementsAstro).toContain("buildPatternReviewLegacyRedirect");
    expect(expressMeasurementsAstro).not.toContain("/patterns/sleeveless/review/");
  });

  it("builder pages target the pattern workspace with generated=1", () => {
    expect(sleevelessBuilderAstro).toContain(
      'data-express-review-href="/patterns/sleeveless/pattern/?generated=1"',
    );
    expect(dropShoulderBuilderAstro).toContain(
      'data-express-review-href="/patterns/drop-shoulder/pattern/?generated=1"',
    );
    expect(sleevelessBuilderAstro).not.toContain("/patterns/sleeveless/review");
    expect(dropShoulderBuilderAstro).not.toContain("/patterns/drop-shoulder/review");
  });
});
