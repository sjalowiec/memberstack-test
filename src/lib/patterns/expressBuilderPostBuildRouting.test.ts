import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveExpressBuilderPostBuildHref } from "./expressBuilderPostBuildRouting";
import {
  DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF,
  SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF,
} from "./customPatternProjectNavigation";
import { maybeAutoSaveFirstFreePattern } from "./patternAutoSaveFirstFree";

vi.mock("./sleevelessPatternSystemAccessClient", () => ({
  resolveSleevelessUserAccess: vi.fn(),
  markFreePatternClaimedForSystem: vi.fn(),
}));

import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";

const expressPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-express-page.ts"),
  "utf8",
);

describe("resolveExpressBuilderPostBuildHref", () => {
  it("routes paid members to the generated workspace with edit auto-open", () => {
    expect(
      resolveExpressBuilderPostBuildHref(SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF, true),
    ).toBe("/patterns/sleeveless/pattern/?generated=1&edit=1");
    expect(
      resolveExpressBuilderPostBuildHref(DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF, true),
    ).toBe("/patterns/drop-shoulder/pattern/?generated=1&edit=1");
  });

  it("routes free and logged-out users directly to the generated pattern workspace", () => {
    expect(
      resolveExpressBuilderPostBuildHref(SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF, false),
    ).toBe("/patterns/sleeveless/pattern/?generated=1");
    expect(
      resolveExpressBuilderPostBuildHref(DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF, false),
    ).toBe("/patterns/drop-shoulder/pattern/?generated=1");
  });

  it("preserves existing query params and appends edit=1 for members", () => {
    expect(
      resolveExpressBuilderPostBuildHref(
        "/patterns/sleeveless/pattern/?generated=1&tab=pattern",
        true,
      ),
    ).toBe("/patterns/sleeveless/pattern/?generated=1&tab=pattern&edit=1");
  });

  it("does not duplicate edit=1 when already present", () => {
    expect(
      resolveExpressBuilderPostBuildHref(
        "/patterns/sleeveless/pattern/?generated=1&edit=1",
        true,
      ),
    ).toBe("/patterns/sleeveless/pattern/?generated=1&edit=1");
  });
});

describe("express builder post-build integration", () => {
  beforeEach(() => {
    vi.mocked(resolveSleevelessUserAccess).mockReset();
  });

  it("wires membership-aware routing in the shared express builder client", () => {
    expect(expressPageSrc).toContain("resolveExpressBuilderPostBuildHref");
    expect(expressPageSrc).toContain("resolveSleevelessUserAccess");
    expect(expressPageSrc).toContain("hasSystemAccess");
    expect(expressPageSrc).toContain("persistExpressBuilderState");
  });

  it("defers edit-workspace auto-open until builder handoff completes", () => {
    const editDrawerSrc = readFileSync(
      resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
      "utf8",
    );
    expect(editDrawerSrc).toContain("waitForBuilderHandoffComplete");
    expect(editDrawerSrc).toContain("PATTERN_WORKSPACE_BUILDER_HANDOFF_COMPLETE_EVENT");
    expect(editDrawerSrc).toContain("returnToUpdatedPatternView");
  });

  it("does not auto-save a duplicate pattern for paid members on generated arrival", async () => {
    vi.mocked(resolveSleevelessUserAccess).mockResolvedValue({
      loggedIn: true,
      memberId: "ms_paid",
      hasSystemAccess: true,
      freeClaimsBySystem: {},
    });

    const result = await maybeAutoSaveFirstFreePattern({ showSuccessDialog: false });
    expect(result).toEqual({ status: "skipped", reason: "has-system-access" });
  });
});
