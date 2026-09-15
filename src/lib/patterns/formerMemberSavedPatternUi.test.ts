import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SAVED_PATTERN_READONLY_NOTICE,
  SAVED_PATTERN_READONLY_RENEW_HREF,
  SAVED_PATTERN_READONLY_RENEW_LABEL,
} from "./savedPatternAccessState";

const gate = readFileSync(resolve("src/components/patterns/SleevelessPatternMemberGate.astro"), "utf8");
const socksPatternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
const socksPatternScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
const hatBuilder = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
const videoCatalogAccess = readFileSync(resolve("src/lib/videos/videoCatalogAccessState.ts"), "utf8");
const membershipRules = readFileSync(resolve("docs/membership-rules.md"), "utf8");
const chrome = readFileSync(resolve("src/lib/patterns/savedPatternReadOnlyChrome.ts"), "utf8");

describe("former-member saved-pattern UI policy", () => {
  it("renders the approved read-only notice and Renew Membership action", () => {
    expect(gate).toContain(SAVED_PATTERN_READONLY_NOTICE);
    expect(gate).toContain(SAVED_PATTERN_READONLY_RENEW_LABEL);
    expect(gate).toContain(`href="${SAVED_PATTERN_READONLY_RENEW_HREF}"`);
    expect(gate).toContain("data-sleeveless-pattern-gate-readonly");
  });

  it("keeps print on the Socks pattern page and skips Edit in read-only mode", () => {
    expect(socksPatternPage).toContain("data-socks-edit-open");
    expect(socksPatternScript).toContain("isSavedPatternReadOnlyDocument");
    expect(socksPatternScript).toContain("triggerPatternPrint");
    expect(socksPatternScript).toContain("hydrateGlossaryTooltipPlaceholders");
  });

  it("does not membership-gate the free Hat builder", () => {
    expect(hatBuilder).not.toContain("SleevelessPatternMemberGate");
    expect(hatBuilder).not.toContain("initPatternMembershipPageGate");
  });

  it("does not expand catalog video access through the saved-pattern model", () => {
    expect(videoCatalogAccess).toContain("hasMemberAccess");
    expect(videoCatalogAccess).not.toContain("savedPatternAccessState");
    expect(chrome).not.toContain("player.vimeo.com");
    expect(membershipRules).toContain("Broader learning-library access");
  });
});
