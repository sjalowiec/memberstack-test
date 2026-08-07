/**
 * Regression: hat.astro must use the current patternTipDismiss API after bust-dart
 * cherry-picks (updateTipsResetLinkVisibility was removed).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as tipDismiss from "./patternTipDismiss";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const hatAstro = readFileSync(join(root, "src/pages/patterns/hat.astro"), "utf8");

describe("hat pattern-tip dismiss API (production)", () => {
  it("patternTipDismiss no longer exports updateTipsResetLinkVisibility", () => {
    expect("updateTipsResetLinkVisibility" in tipDismiss).toBe(false);
    expect(typeof tipDismiss.resetDismissedTips).toBe("function");
    expect(typeof tipDismiss.refreshPatternTipDismiss).toBe("function");
    expect(typeof tipDismiss.bindPatternTipDismiss).toBe("function");
  });

  it("hat.astro imports and uses resetDismissedTips, not the removed reset-link helper", () => {
    expect(hatAstro).toMatch(/resetDismissedTips/);
    expect(hatAstro).toMatch(/window\.kbmResetDismissedTips\s*=\s*resetDismissedTips/);
    expect(hatAstro).toMatch(/kbmResetDismissedTips\('hat-show-tips'\)/);
    expect(hatAstro).not.toMatch(/updateTipsResetLinkVisibility/);
    expect(hatAstro).not.toMatch(/kbmUpdateTipsResetLinkVisibility/);
  });

  it("hat tip init uses the two-argument bindPatternTipDismiss signature", () => {
    expect(hatAstro).toMatch(/bindPatternTipDismiss\(\s*scope,\s*HAT_TIPS_STORAGE_KEY\s*\)/);
    expect(hatAstro).not.toMatch(/bindPatternTipDismiss\(\s*scope,\s*HAT_TIPS_STORAGE_KEY\s*,/);
  });

  it("hat tip init does not call the removed membership lock helpers", () => {
    expect(hatAstro).not.toMatch(/installPatternBuilderAccountGate\s*\(/);
    expect(hatAstro).not.toMatch(/lockPatternBuilderForLoggedOut\s*\(/);
  });
});
