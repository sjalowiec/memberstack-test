import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("denied video membership actions", () => {
  const client = readFileSync(
    join(process.cwd(), "src", "scripts", "gatedVimeoEmbedClient.ts"),
    "utf8",
  );
  const panel = readFileSync(
    join(process.cwd(), "src", "lib", "videos", "lockedVideoPanel.ts"),
    "utf8",
  );
  const embed = readFileSync(
    join(process.cwd(), "src", "components", "videos", "GatedVimeoEmbed.astro"),
    "utf8",
  );

  it("keeps Become a Member primary and styles login as a tappable outlined button", () => {
    expect(embed).toContain('ctaHref = "/membership"');
    expect(embed).toContain('ctaText = "Become a Member"');
    expect(panel).toContain('class="kbm-video__cta"');
    expect(panel).toContain("kbm-video__cta kbm-video__cta--login");
    expect(panel).toContain("Already a member? Log in");
    expect(client).toContain("lockedVideoPanelHtml");
    expect(client).toContain("openMemberstackLoginModal");
    expect(embed).toContain(":global(.kbm-video__cta)");
    expect(embed).toContain("min-height:44px");
    expect(embed).toContain("appearance:none");
    expect(embed).toContain(":global(.kbm-video__cta--login)");
    expect(embed).toContain("background:#fff");
    expect(embed).toContain("flex-direction:column");
  });

  it("keeps the primary Become a Member link white against global link colors", () => {
    const globalCss = readFileSync(join(process.cwd(), "src", "styles", "global.css"), "utf8");
    const primaryLinkStates = [
      "a.kbm-video__cta:link",
      "a.kbm-video__cta:visited",
      "a.kbm-video__cta:hover",
      "a.kbm-video__cta:focus",
      "a.kbm-video__cta:active",
    ];
    const rule = globalCss.match(
      /a\.kbm-video__cta:link\s*,\s*a\.kbm-video__cta:visited\s*,\s*a\.kbm-video__cta:hover\s*,\s*a\.kbm-video__cta:focus\s*,\s*a\.kbm-video__cta:active\s*\{([^}]+)\}/,
    );

    expect(rule, "primary locked-video link needs a global color rule").not.toBeNull();
    for (const selector of primaryLinkStates) {
      expect(globalCss).toContain(selector);
    }
    expect(rule?.[1]).toMatch(/color:\s*#fff\b/);
    expect(rule?.[0]).not.toContain("kbm-video__cta--login");
    expect(globalCss).not.toMatch(/a\.kbm-video__cta--login[^{]*\{[^}]*color:\s*#fff\b/);

    expect(embed).toMatch(
      /:global\(\.kbm-video__cta--login\)\{\s*background:#fff;\s*color:\s*var\(--kbm-green,\s*#52682d\);/,
    );
  });
});
