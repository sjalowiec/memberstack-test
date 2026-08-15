/**
 * Regression: finished Hat Pattern uses the current patternTipDismiss API
 * (updateTipsResetLinkVisibility was removed). The legacy /patterns/hat wizard
 * is a redirect and no longer hosts tip-dismiss wiring.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as tipDismiss from "./patternTipDismiss";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const hatAstro = readFileSync(join(root, "src/pages/patterns/hat.astro"), "utf8");
const hatPatternAstro = readFileSync(
  join(root, "src/pages/patterns/hat/pattern.astro"),
  "utf8",
);
const tipsToggleAstro = readFileSync(
  join(root, "src/components/patterns/PatternTipsToggle.astro"),
  "utf8",
);

describe("hat pattern-tip dismiss API (production)", () => {
  it("patternTipDismiss no longer exports updateTipsResetLinkVisibility", () => {
    expect("updateTipsResetLinkVisibility" in tipDismiss).toBe(false);
    expect(typeof tipDismiss.resetDismissedTips).toBe("function");
    expect(typeof tipDismiss.refreshPatternTipDismiss).toBe("function");
    expect(typeof tipDismiss.bindPatternTipDismiss).toBe("function");
  });

  it("legacy /patterns/hat is a redirect and does not host tip-dismiss wiring", () => {
    expect(hatAstro).toContain("buildHatLegacyEntryRedirect");
    expect(hatAstro).toContain("Astro.redirect");
    expect(hatAstro).not.toMatch(/resetDismissedTips/);
    expect(hatAstro).not.toMatch(/bindPatternTipDismiss/);
    expect(hatAstro).not.toMatch(/updateTipsResetLinkVisibility/);
    expect(hatAstro).not.toMatch(/kbmUpdateTipsResetLinkVisibility/);
  });

  it("finished Hat Pattern uses PatternTipsToggle with the hat storage key", () => {
    expect(hatPatternAstro).toContain("PatternTipsToggle");
    expect(hatPatternAstro).toContain('storageKey="hat-show-tips"');
    expect(hatPatternAstro).not.toMatch(/updateTipsResetLinkVisibility/);
    expect(hatPatternAstro).not.toMatch(/installPatternBuilderAccountGate\s*\(/);
    expect(hatPatternAstro).not.toMatch(/lockPatternBuilderForLoggedOut\s*\(/);
  });

  it("PatternTipsToggle uses the two-argument bindPatternTipDismiss signature", () => {
    expect(tipsToggleAstro).toMatch(/bindPatternTipDismiss\(\s*scope,\s*key\s*\)/);
    expect(tipsToggleAstro).not.toMatch(/bindPatternTipDismiss\(\s*scope,\s*key\s*,/);
  });
});
