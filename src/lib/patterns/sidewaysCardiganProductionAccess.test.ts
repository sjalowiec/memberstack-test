import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSidewaysCardiganProductionBlocked,
  isSidewaysCardiganRoute,
} from "./sidewaysCardiganProductionAccess";

const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");
const membershipGate = readFileSync(resolve("src/lib/patterns/patternMembershipPageGate.ts"), "utf8");
const savedPatternViewRoute = readFileSync(
  resolve("src/lib/patterns/savedPatternViewRoute.ts"),
  "utf8",
);

describe("isSidewaysCardiganRoute", () => {
  it("matches the sideways-cardigan prefix and nested routes", () => {
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan")).toBe(true);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan/")).toBe(true);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan/builder")).toBe(true);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan/builder/")).toBe(true);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan/review")).toBe(true);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan/pattern/")).toBe(true);
  });

  it("does not match other pattern routes", () => {
    expect(isSidewaysCardiganRoute("/patterns/drop-shoulder/builder")).toBe(false);
    expect(isSidewaysCardiganRoute("/patterns/sleeveless/builder")).toBe(false);
    expect(isSidewaysCardiganRoute("/patterns/socks/builder")).toBe(false);
    expect(isSidewaysCardiganRoute("/patterns/hat/builder")).toBe(false);
    expect(isSidewaysCardiganRoute("/patterns/sideways-cardigan-extra")).toBe(false);
    expect(isSidewaysCardiganRoute("/patterns")).toBe(false);
  });
});

describe("isSidewaysCardiganProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isSidewaysCardiganProductionBlocked("knititnow.com")).toBe(true);
    expect(isSidewaysCardiganProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isSidewaysCardiganProductionBlocked("app.knititnow.com")).toBe(true);
    expect(isSidewaysCardiganProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("allows localhost, Astro dev, and Netlify previews", () => {
    expect(isSidewaysCardiganProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isSidewaysCardiganProductionBlocked("localhost")).toBe(false);
    expect(isSidewaysCardiganProductionBlocked("127.0.0.1")).toBe(false);
    expect(isSidewaysCardiganProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
    expect(isSidewaysCardiganProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(isSidewaysCardiganProductionBlocked("unknown-staging.example.com")).toBe(false);
  });
});

describe("Sideways catalog and route wiring", () => {
  it("shows Sideways as Coming Soon on production and keeps the live card for DEV", () => {
    expect(catalog).toContain("isSidewaysCardiganProductionBlocked");
    expect(catalog).toContain("showSidewaysAsComingSoon");
    expect(catalog).toContain("...(showSidewaysAsComingSoon ? [] : [sidewaysPattern])");
    expect(catalog).toContain("...(showSidewaysAsComingSoon");
    expect(catalog).toContain("title: 'Sideways Knit Sweater'");
    expect(catalog).toContain("href: '/patterns/sideways-cardigan'");
    expect(catalog).not.toContain("href: '/patterns/sideways-cardigan/builder?new=1'");
    expect(catalog).toContain("image: '/images/patterns/sideways.png'");
    expect(catalog).toContain("button: 'Create sideways knit sweater'");

    const comingSoonConst = catalog.slice(
      catalog.indexOf("const comingSoonPatterns"),
      catalog.indexOf("<Layout"),
    );
    expect(comingSoonConst).toContain("showSidewaysAsComingSoon");
    expect(comingSoonConst).toContain("sidewaysPattern.title");
    expect(comingSoonConst).toContain("sidewaysPattern.image");
    expect(comingSoonConst).toContain("sidewaysPattern.copy");
    expect(comingSoonConst).not.toContain("href:");
    expect(comingSoonConst).not.toContain("button:");

    const comingSoonMarkup = catalog.slice(
      catalog.indexOf('id="patterns-coming-heading"'),
      catalog.indexOf("</Layout>"),
    );
    expect(comingSoonMarkup).toContain("comingSoonPatterns.map");
    expect(comingSoonMarkup).toContain('class="catalog-card catalog-card--soon"');
    expect(comingSoonMarkup).toContain('aria-disabled="true"');
    expect(comingSoonMarkup).toContain("Coming soon");
    expect(comingSoonMarkup).not.toContain("href={pattern.href}");
    expect(comingSoonMarkup).not.toContain("pattern.button");
  });

  it("middleware redirects blocked Sideways builder and workspace routes to the catalog", () => {
    expect(middleware).toContain("isSidewaysCardiganRoute");
    expect(middleware).toContain("isSidewaysCardiganProductionBlocked");
    expect(middleware).toMatch(
      /isSidewaysCardiganRoute\(u\.pathname\)[\s\S]*isSidewaysCardiganProductionBlocked\(u\.hostname, devOnlyRouteEnv\)[\s\S]*context\.redirect\("\/patterns\/", 302\)/,
    );
  });

  it("does not change Socks, Sleeveless, Drop Shoulder, or Hat live catalog cards", () => {
    expect(catalog).toContain("href: '/patterns/sleeveless'");
    expect(catalog).toContain("href: '/patterns/drop-shoulder'");
    expect(catalog).toContain("href: '/patterns/hat/builder?new=1'");
    expect(catalog).toContain("href: '/patterns/socks'");
    expect(catalog).toContain("title: 'Sleeveless Sweater'");
    expect(catalog).toContain("title: 'Drop Shoulder Sweater'");
    expect(catalog).toContain("title: 'Hat'");
    expect(catalog).toContain("title: 'Socks'");
  });

  it("leaves former-member read-only wiring for released Pattern Builders unchanged", () => {
    expect(membershipGate).toContain("applyFormerMemberReadOnlyException");
    expect(membershipGate).toContain("isPaidSavedPatternReadOnlyCandidate");
    expect(savedPatternViewRoute).toContain("\\/patterns\\/socks\\/pattern");
    expect(savedPatternViewRoute).toContain("\\/patterns\\/sleeveless\\/pattern");
    expect(savedPatternViewRoute).toContain("\\/patterns\\/drop-shoulder\\/pattern");
  });
});
