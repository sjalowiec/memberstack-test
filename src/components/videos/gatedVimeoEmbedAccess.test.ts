import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("denied video membership actions", () => {
  const client = readFileSync(
    join(process.cwd(), "src", "scripts", "gatedVimeoEmbedClient.ts"),
    "utf8",
  );
  const embed = readFileSync(
    join(process.cwd(), "src", "components", "videos", "GatedVimeoEmbed.astro"),
    "utf8",
  );

  it("keeps Become a Member primary and styles login as a tappable outlined button", () => {
    expect(embed).toContain('ctaHref = "/membership"');
    expect(embed).toContain('ctaText = "Become a Member"');
    expect(client).toContain('class="kbm-video__cta"');
    expect(client).toContain("kbm-video__cta kbm-video__cta--login");
    expect(client).toContain("Already a member? Log in");
    expect(client).toContain("openMemberstackLoginModal");
    expect(embed).toContain(":global(.kbm-video__cta)");
    expect(embed).toContain("min-height:44px");
    expect(embed).toContain("appearance:none");
    expect(embed).toContain(":global(.kbm-video__cta--login)");
    expect(embed).toContain("background:#fff");
    expect(embed).toContain("flex-direction:column");
  });
});
