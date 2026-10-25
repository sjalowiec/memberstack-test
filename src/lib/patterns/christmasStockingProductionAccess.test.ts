import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHRISTMAS_STOCKING_TEMPORARILY_UNAVAILABLE_MESSAGE,
  christmasStockingTemporarilyUnavailableResponse,
  isChristmasStockingProductionBlocked,
  isChristmasStockingRoute,
} from "./christmasStockingProductionAccess";

const catalog = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
const middleware = readFileSync(resolve("src/middleware.ts"), "utf8");

describe("isChristmasStockingRoute", () => {
  it("matches the landing, builder, and generated instruction routes", () => {
    expect(isChristmasStockingRoute("/patterns/christmas-stocking")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/builder")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/builder/")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/pattern")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/pattern/")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/summary")).toBe(true);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking/edit")).toBe(true);
  });

  it("does not match Basic Socks or other pattern routes", () => {
    expect(isChristmasStockingRoute("/patterns/socks")).toBe(false);
    expect(isChristmasStockingRoute("/patterns/socks/builder")).toBe(false);
    expect(isChristmasStockingRoute("/patterns/socks/pattern")).toBe(false);
    expect(isChristmasStockingRoute("/patterns/hat/builder")).toBe(false);
    expect(isChristmasStockingRoute("/patterns/sleeveless/builder")).toBe(false);
    expect(isChristmasStockingRoute("/patterns/christmas-stocking-extra")).toBe(false);
    expect(isChristmasStockingRoute("/patterns")).toBe(false);
  });
});

describe("isChristmasStockingProductionBlocked", () => {
  it("blocks production custom domains", () => {
    expect(isChristmasStockingProductionBlocked("knititnow.com")).toBe(true);
    expect(isChristmasStockingProductionBlocked("www.knititnow.com")).toBe(true);
    expect(isChristmasStockingProductionBlocked("app.knititnow.com")).toBe(true);
    expect(isChristmasStockingProductionBlocked("app.knitbymachine.com")).toBe(true);
  });

  it("stays available on localhost, Astro dev, and Netlify DEV hosts", () => {
    expect(isChristmasStockingProductionBlocked("localhost", { isViteDev: true })).toBe(false);
    expect(isChristmasStockingProductionBlocked("localhost")).toBe(false);
    expect(isChristmasStockingProductionBlocked("127.0.0.1")).toBe(false);
    expect(isChristmasStockingProductionBlocked("deploy-preview--kin.netlify.app")).toBe(false);
    expect(isChristmasStockingProductionBlocked("kin-dev.netlify.app")).toBe(false);
    expect(isChristmasStockingProductionBlocked("unknown-staging.example.com")).toBe(false);
  });
});

describe("Christmas Stocking catalog and route wiring", () => {
  it("omits the catalog card on production and keeps the card definition for DEV", () => {
    expect(catalog).toContain("isChristmasStockingProductionBlocked");
    expect(catalog).toContain("hideChristmasStockingInCatalog");
    expect(catalog).toContain("...(hideChristmasStockingInCatalog ? [] : [christmasStockingPattern])");
    expect(catalog).toContain("title: 'Christmas Stocking'");
    expect(catalog).toContain("href: '/patterns/christmas-stocking'");
    expect(catalog).toContain("button: 'Create your stocking'");

    const sweaterList = catalog.slice(
      catalog.indexOf("const sweaterPatterns"),
      catalog.indexOf("const availablePatterns"),
    );
    const availableList = catalog.slice(
      catalog.indexOf("const availablePatterns"),
      catalog.indexOf("const comingSoonPatterns"),
    );
    expect(sweaterList).toContain("...(hideChristmasStockingInCatalog ? [] : [christmasStockingPattern])");
    expect(availableList).toContain("...(hideChristmasStockingInCatalog ? [] : [christmasStockingPattern])");
    expect(sweaterList).not.toMatch(/^\s*christmasStockingPattern,/m);
    expect(availableList).not.toMatch(/^\s*christmasStockingPattern,/m);
  });

  it("middleware shows a short unavailable message for blocked Christmas Stocking routes", () => {
    expect(middleware).toContain("isChristmasStockingRoute");
    expect(middleware).toContain("isChristmasStockingProductionBlocked");
    expect(middleware).toContain("christmasStockingTemporarilyUnavailableResponse");
    expect(middleware).toMatch(
      /isChristmasStockingRoute\(u\.pathname\)[\s\S]*isChristmasStockingProductionBlocked\(u\.hostname, devOnlyRouteEnv\)[\s\S]*return christmasStockingTemporarilyUnavailableResponse\(\)/,
    );
  });

  it("leaves Basic Socks in the catalog", () => {
    expect(catalog).toContain("title: 'Socks'");
    expect(catalog).toContain("href: '/patterns/socks'");
    expect(catalog).toContain("button: 'Create your socks'");
    expect(catalog).toContain("socksPattern,");
  });
});

describe("christmasStockingTemporarilyUnavailableResponse", () => {
  it("returns the short unavailable message", async () => {
    const response = christmasStockingTemporarilyUnavailableResponse();
    expect(response.status).toBe(503);
    expect(await response.text()).toContain(CHRISTMAS_STOCKING_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
