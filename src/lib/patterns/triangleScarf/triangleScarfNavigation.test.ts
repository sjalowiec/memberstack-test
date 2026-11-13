import { describe, expect, it } from "vitest";
import {
  buildTriangleScarfBuilderNewPatternHref,
  buildTriangleScarfLegacyEntryRedirect,
  buildTriangleScarfPatternHref,
  buildTriangleScarfShareHref,
  isTriangleScarfNewSession,
  resolveTriangleScarfSummaryEntryPath,
} from "./triangleScarfNavigation";

describe("triangle scarf routes", () => {
  it("sends a bare entry URL to the builder and a share URL to the pattern", () => {
    expect(buildTriangleScarfLegacyEntryRedirect("https://knititnow.com/patterns/triangle-scarf")).toBe(
      "/patterns/triangle-scarf/builder",
    );
    expect(
      buildTriangleScarfLegacyEntryRedirect(
        "https://knititnow.com/patterns/triangle-scarf?w=18&l=36&sg=7&rg=10&n=200&u=in&method=wide-to-point",
      ),
    ).toBe("/patterns/triangle-scarf/pattern/?w=18&l=36&sg=7&rg=10&n=200&u=in");
    expect(
      buildTriangleScarfLegacyEntryRedirect(
        "https://knititnow.com/patterns/triangle-scarf?w=18&l=36&sg=7&rg=10&n=200&u=in&na=eon",
      ),
    ).toBe("/patterns/triangle-scarf/pattern/?w=18&l=36&sg=7&rg=10&n=200&u=in");
  });

  it("keeps partial queries on the builder", () => {
    expect(
      buildTriangleScarfLegacyEntryRedirect("https://knititnow.com/patterns/triangle-scarf?l=36&u=cm"),
    ).toBe("/patterns/triangle-scarf/builder?l=36&u=cm");
  });

  it("builds the public share link from the entry URL", () => {
    expect(
      buildTriangleScarfShareHref("https://knititnow.com", {
        depth: 18,
        length: 36,
        stitchGauge: 7,
        rowGauge: 10,
        needles: 200,
        unit: "in",
      }),
    ).toBe("https://knititnow.com/patterns/triangle-scarf?w=18&l=36&sg=7&rg=10&n=200&u=in");
    expect(
      buildTriangleScarfPatternHref({
        depth: 18,
        length: 36,
        stitchGauge: 7,
        rowGauge: 10,
        needles: 200,
        unit: "in",
      }),
    ).toContain("/patterns/triangle-scarf/pattern/?");
  });

  it("starts a new scarf from the same fresh-start flag as the hat builder", () => {
    expect(buildTriangleScarfBuilderNewPatternHref()).toBe("/patterns/triangle-scarf/builder?new=1");
    expect(isTriangleScarfNewSession("?new=1")).toBe(true);
    expect(isTriangleScarfNewSession("?w=18")).toBe(false);
  });

  it("uses the sweater generated flag for the summary entry path", () => {
    expect(resolveTriangleScarfSummaryEntryPath("?generated=1")).toBe("from-builder");
    expect(resolveTriangleScarfSummaryEntryPath("?edit=1")).toBe("from-finished-pattern");
  });
});
