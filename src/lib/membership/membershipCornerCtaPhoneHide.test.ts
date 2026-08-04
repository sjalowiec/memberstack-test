import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cornerCtaAstro = readFileSync(
  resolve("src/components/membership/MembershipCornerCta.astro"),
  "utf8",
);
const cornerControlAstro = readFileSync(
  resolve("src/components/membership/MembershipCornerControl.astro"),
  "utf8",
);
const baseLayoutAstro = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
const indexAstro = readFileSync(resolve("src/pages/index.astro"), "utf8");

describe("membership corner CTA — phone hide contract", () => {
  it("hides the sitewide sticky/corner CTA at phone widths (≤767.98px)", () => {
    expect(cornerCtaAstro).toContain('data-membership-corner-cta');
    expect(cornerCtaAstro).toContain("class=\"membership-corner-cta\"");
    expect(cornerCtaAstro).toMatch(/@media\s*\(\s*max-width:\s*767\.98px\s*\)/);
    expect(cornerCtaAstro).toMatch(
      /@media\s*\(\s*max-width:\s*767\.98px\s*\)\s*\{[\s\S]*?display:\s*none\s*!important/,
    );
    // Must not resurrect the full-width phone sticky bar.
    expect(cornerCtaAstro).not.toMatch(
      /@media\s*\(\s*max-width:\s*767(?:\.98)?px\s*\)\s*\{[\s\S]*?width:\s*100%/,
    );
    expect(cornerCtaAstro).not.toMatch(
      /@media\s*\(\s*max-width:\s*767(?:\.98)?px\s*\)\s*\{[\s\S]*?display:\s*flex/,
    );
  });

  it("keeps the floating pill styles for tablet/desktop (no phone-only layout rewrite)", () => {
    expect(cornerCtaAstro).toContain("position: fixed");
    expect(cornerCtaAstro).toContain("border-radius: 999px");
    expect(cornerCtaAstro).toContain("var(--kbm-accent, #c2614e)");
    expect(cornerCtaAstro).toContain("z-index: 2800");
  });

  it("is mounted sitewide via BaseLayout, not as the homepage card CTA", () => {
    expect(baseLayoutAstro).toContain("MembershipCornerControl");
    expect(cornerControlAstro).toContain("MembershipCornerCta");
    // Homepage white membership card CTAs stay as normal page links.
    expect(indexAstro).toMatch(
      /home-v2-hero__actions[\s\S]*?<a href="\/membership" class="kbm-btn kbm-btn-outline">Become a Member<\/a>/,
    );
    expect(indexAstro).toMatch(
      /<a href="\/membership" class="kbm-btn kbm-btn-outline">Become a Member<\/a>/,
    );
    expect(indexAstro).not.toContain("membership-corner-cta");
    expect(indexAstro).not.toContain("data-membership-corner-cta");
  });
});
